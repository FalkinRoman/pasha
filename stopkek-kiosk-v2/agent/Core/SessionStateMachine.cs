using Microsoft.Extensions.Logging;
using StopkekAgent.Api;
using StopkekAgent.Config;

namespace StopkekAgent.Core;

/// <summary>
/// The brain. Turns a stream of poll results (possibly failing) into a stable
/// KioskView, applying:
///   - monotonic countdown (clock-tamper proof, survives short network gaps),
///   - hysteresis (network flapping must not flicker LOCKED↔ACTIVE),
///   - "finish your match" grace before re-locking after time runs out,
///   - fail-secure offline policy (locked stays locked; active keeps its paid time).
/// Pure given (PollResult, elapsedMs): no I/O, fully unit-testable.
/// </summary>
public sealed class SessionStateMachine
{
    private const int LockHysteresis = 2; // consecutive 'locked' reads to drop an active session

    private readonly KioskConfig _cfg;
    private readonly ILogger _log;

    // Monotonic anchor for remaining time.
    private long _remainingAnchorMs;     // server displayRemainingMs at anchor
    private long _anchorElapsedMs = -1;  // monotonic clock value when anchored

    private long _graceDeadlineMs = -1;  // monotonic deadline for grace end
    private int _lockedStreak;
    private long _revision;

    private KioskMode _mode = KioskMode.Locked;
    private KioskView _last;

    public SessionStateMachine(KioskConfig cfg, ILogger log)
    {
        _cfg = cfg;
        _log = log;
        _last = new KioskView
        {
            Mode = KioskMode.Locked,
            Online = false,
            SeatNumber = cfg.SeatNumber,
            Message = cfg.LockOnStartup ? "Запуск…" : null,
            Revision = 0,
        };
    }

    public KioskView Current => _last;

    public KioskView Apply(PollResult poll, long elapsedMs)
    {
        KioskView view = poll.Reachable && poll.State is not null
            ? ApplyOnline(poll.State, elapsedMs)
            : ApplyOffline(poll.Error, elapsedMs);

        if (view.Mode != _last.Mode)
            _log.LogInformation("mode {Old} -> {New} (online={Online})", _last.Mode, view.Mode, view.Online);

        _last = view;
        return view;
    }

    private KioskView ApplyOnline(KioskStateDto state, long elapsedMs)
    {
        switch (state.State)
        {
            case "active":
                return EnterActive(state, elapsedMs);

            case "expired":
                return EnterGrace(state, elapsedMs);

            case "locked":
            default:
                return EnterLockedWithHysteresis(state, elapsedMs);
        }
    }

    private KioskView EnterActive(KioskStateDto state, long elapsedMs)
    {
        _lockedStreak = 0;
        _graceDeadlineMs = -1;

        var s = state.Session;
        // Re-anchor the monotonic countdown to the server's authoritative value.
        if (s is not null)
        {
            _remainingAnchorMs = Math.Max(0, s.DisplayRemainingMs);
            _anchorElapsedMs = elapsedMs;
        }

        long remaining = ComputeRemaining(elapsedMs);

        // Server says active but local countdown hit zero -> slide into grace.
        if (remaining <= 0)
            return EnterGrace(state, elapsedMs);

        _mode = KioskMode.Active;
        return new KioskView
        {
            Mode = KioskMode.Active,
            Online = true,
            SeatNumber = _cfg.SeatNumber,
            UserName = s?.UserName,
            ZoneName = s?.ZoneName,
            BalanceRub = s?.BalanceRub ?? 0,
            RemainingMs = remaining,
            Notice = state.Notice,
            ToastText = state.Toast?.Text,
            ToastId = state.Toast?.Id,
            Revision = ++_revision,
        };
    }

    private KioskView EnterGrace(KioskStateDto state, long elapsedMs)
    {
        _lockedStreak = 0;
        if (_cfg.Grace <= TimeSpan.Zero)
            return Lock("Время вышло", state, elapsedMs);

        if (_graceDeadlineMs < 0)
        {
            _graceDeadlineMs = elapsedMs + (long)_cfg.Grace.TotalMilliseconds;
            _log.LogInformation("grace started: {Sec}s", _cfg.GraceSeconds);
        }

        long graceLeft = _graceDeadlineMs - elapsedMs;
        if (graceLeft <= 0)
            return Lock("Грейс истёк", state, elapsedMs);

        _mode = KioskMode.Grace;
        var s = state.Session;
        return new KioskView
        {
            Mode = KioskMode.Grace,
            Online = true,
            SeatNumber = _cfg.SeatNumber,
            UserName = s?.UserName,
            ZoneName = s?.ZoneName,
            BalanceRub = s?.BalanceRub ?? 0,
            RemainingMs = 0,
            GraceRemainingMs = graceLeft,
            Notice = "Время вышло — продлите в приложении",
            ToastText = state.Toast?.Text,
            ToastId = state.Toast?.Id,
            Revision = ++_revision,
        };
    }

    private KioskView EnterLockedWithHysteresis(KioskStateDto state, long elapsedMs)
    {
        // If we were playing, require a couple of consecutive 'locked' reads so a
        // single glitched poll can't drop a paying customer mid-game.
        if (_mode is KioskMode.Active or KioskMode.Grace)
        {
            _lockedStreak++;
            if (_lockedStreak < LockHysteresis)
            {
                _log.LogDebug("locked read {N}/{Max}, holding session", _lockedStreak, LockHysteresis);
                return _last with { Revision = ++_revision };
            }
        }
        return Lock(null, state, elapsedMs);
    }

    private KioskView Lock(string? message, KioskStateDto state, long elapsedMs)
    {
        _mode = KioskMode.Locked;
        _lockedStreak = 0;
        _graceDeadlineMs = -1;
        _anchorElapsedMs = -1;
        return new KioskView
        {
            Mode = KioskMode.Locked,
            Online = true,
            SeatNumber = _cfg.SeatNumber,
            QrPayload = state.QrPayload,
            QrRefreshSec = state.QrRefreshSec ?? 120,
            QrImageBase64 = state.QrImage,
            Message = message,
            ToastText = state.Toast?.Text,
            ToastId = state.Toast?.Id,
            Revision = ++_revision,
        };
    }

    private KioskView ApplyOffline(string? error, long elapsedMs)
    {
        // Keep-alive policy depends on what we were doing when the network dropped.
        switch (_mode)
        {
            case KioskMode.Active:
            {
                long remaining = ComputeRemaining(elapsedMs);
                if (remaining <= 0)
                    return ApplyOfflineGrace(elapsedMs);
                return _last with
                {
                    Online = false,
                    RemainingMs = remaining,
                    Message = "Нет связи с сервером — время идёт по локальному таймеру",
                    Revision = ++_revision,
                };
            }
            case KioskMode.Grace:
                return ApplyOfflineGrace(elapsedMs);

            case KioskMode.Locked:
            default:
                return new KioskView
                {
                    Mode = KioskMode.Locked,
                    Online = false,
                    SeatNumber = _cfg.SeatNumber,
                    QrPayload = _last.QrPayload, // reuse last QR if we had one
                    QrRefreshSec = _last.QrRefreshSec,
                    QrImageBase64 = _last.QrImageBase64,
                    Message = "Нет связи с сервером",
                    Revision = ++_revision,
                };
        }
    }

    private KioskView ApplyOfflineGrace(long elapsedMs)
    {
        if (_cfg.Grace <= TimeSpan.Zero)
        {
            _mode = KioskMode.Locked;
            return new KioskView
            {
                Mode = KioskMode.Locked, Online = false, SeatNumber = _cfg.SeatNumber,
                Message = "Время вышло", Revision = ++_revision,
            };
        }
        if (_graceDeadlineMs < 0)
            _graceDeadlineMs = elapsedMs + (long)_cfg.Grace.TotalMilliseconds;

        long graceLeft = _graceDeadlineMs - elapsedMs;
        if (graceLeft <= 0)
        {
            _mode = KioskMode.Locked;
            _graceDeadlineMs = -1;
            return new KioskView
            {
                Mode = KioskMode.Locked, Online = false, SeatNumber = _cfg.SeatNumber,
                Message = "Грейс истёк", Revision = ++_revision,
            };
        }

        _mode = KioskMode.Grace;
        return _last with
        {
            Mode = KioskMode.Grace, Online = false, RemainingMs = 0,
            GraceRemainingMs = graceLeft, Revision = ++_revision,
        };
    }

    private long ComputeRemaining(long elapsedMs)
    {
        if (_anchorElapsedMs < 0) return 0;
        long elapsedSinceAnchor = elapsedMs - _anchorElapsedMs;
        return Math.Max(0, _remainingAnchorMs - elapsedSinceAnchor);
    }
}
