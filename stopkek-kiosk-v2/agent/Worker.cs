using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StopkekAgent.Api;
using StopkekAgent.Config;
using StopkekAgent.Core;
using StopkekAgent.Elevation;
using StopkekAgent.Ipc;
using StopkekAgent.Watchdog;

namespace StopkekAgent;

/// <summary>
/// Main loop: poll server state -> run the state machine -> publish the view to the
/// shell -> run the watchdog. One owner of all moving parts so ordering is explicit.
/// </summary>
public sealed class Worker : BackgroundService
{
    private readonly KioskConfig _cfg;
    private readonly KioskApiClient _api;
    private readonly SessionStateMachine _machine;
    private readonly ShellWatchdog _watchdog;
    private readonly ILogger<Worker> _log;
    private readonly IpcServer _ipc;
    private readonly ElevationServer? _elevation;
    private readonly Stopwatch _clock = Stopwatch.StartNew();

    // Admin "panic exit": once the correct PIN is entered, the agent stops gating for the
    // rest of the current player sign-in. Protection resumes when a fresh shell session
    // connects (the player signs out and back in, or the PC reboots) — see HandleCommandAsync.
    private bool _maintenance;

    // Interrupts the inter-poll sleep so a shell command (e.g. end-session) is reflected on
    // screen within a round-trip instead of waiting up to PollIntervalSec. Cancelling this
    // token wakes the main loop, which re-polls immediately. Only the main loop polls, so the
    // state machine still has a single owner — no races.
    private volatile CancellationTokenSource? _wakeCts;

    public Worker(
        KioskConfig cfg,
        KioskApiClient api,
        SessionStateMachine machine,
        ShellWatchdog watchdog,
        ILogger<Worker> log)
    {
        _cfg = cfg;
        _api = api;
        _machine = machine;
        _watchdog = watchdog;
        _log = log;
        _ipc = new IpcServer(log, HandleCommandAsync);
        _elevation = cfg.ElevateEnabled
            ? new ElevationServer(cfg.ElevateUser, cfg.ElevatePassword, log)
            : null;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation(
            "stopkek-agent up. seat={Seat} api={Api} poll={Poll}s grace={Grace}s",
            _cfg.SeatNumber, _cfg.ApiUrl, _cfg.PollIntervalSec, _cfg.GraceSeconds);

        _ipc.Start(stoppingToken);
        _elevation?.Start(stoppingToken);

        // Publish the fail-secure boot view immediately.
        PublishView(_machine.Current);

        while (!stoppingToken.IsCancellationRequested)
        {
            // Maintenance: admin unlocked the PC for servicing. Stop gating entirely until
            // reboot — no polling, no locking, no watchdog. Just keep the shell hidden.
            if (_maintenance)
            {
                _ipc.Publish(MaintenanceView());
                try { await Task.Delay(_cfg.PollInterval, stoppingToken); }
                catch (OperationCanceledException) { break; }
                continue;
            }

            try
            {
                var poll = await _api.GetStateAsync(stoppingToken);
                var view = _machine.Apply(poll, _clock.ElapsedMilliseconds);
                PublishView(view);

                if (_watchdog.Tick(_ipc.ShellConnected))
                {
                    // Shell vanished and the seat had to be secured — likely a tamper attempt. Flag it.
                    _ = _api.ReportEventAsync("seat_secured",
                        "watchdog disconnected the session after the shell disappeared", CancellationToken.None);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "tick error");
            }

            // Poll faster while a session is winding down so warnings/relock are crisp.
            var delay = _machine.Current.Mode == KioskMode.Active
                        && _machine.Current.RemainingMs is > 0 and < 60_000
                ? TimeSpan.FromSeconds(2)
                : _cfg.PollInterval;

            // Interruptible sleep: a poke (e.g. end-session from the shell) cancels the delay
            // so the next poll fires at once and the lock appears almost immediately.
            using var wake = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            _wakeCts = wake;
            try { await Task.Delay(delay, wake.Token); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (OperationCanceledException) { /* poked — re-poll now */ }
            finally { _wakeCts = null; }
        }

        _watchdog.Stop();
        await _ipc.DisposeAsync();
        if (_elevation is not null) await _elevation.DisposeAsync();
        _log.LogInformation("stopkek-agent stopped");
    }

    private async Task HandleCommandAsync(ShellCommand cmd)
    {
        switch (cmd.Cmd)
        {
            case ShellCommand.EndSession:
                _log.LogInformation("shell requested end-session");
                var ok = await _api.EndSessionAsync(CancellationToken.None);
                _log.LogInformation("end-session result: {Ok}", ok);
                // Server has ended the session — wake the loop so it re-polls now and the
                // lock screen comes up at once instead of after the next poll interval.
                Poke();
                break;

            case ShellCommand.Hello:
                // A fresh shell session attached. The only Hello that can arrive while we're in
                // maintenance is from a NEW sign-in (within the admin's own session the shell
                // stays connected and never re-says hello), so this is the player signing back
                // in — drop maintenance and let normal gating + watchdog resume.
                if (_maintenance)
                {
                    _log.LogWarning("new shell session connected — exiting maintenance, resuming protection");
                    _maintenance = false;
                    _ = _api.ReportEventAsync("maintenance_ended",
                        "new player session — protection resumed", CancellationToken.None);
                }
                _ipc.Publish(_maintenance ? MaintenanceView() : Stamp(_machine.Current)); // re-send current view on demand
                break;

            case ShellCommand.AdminExit:
                HandleAdminExit(cmd.Pin);
                break;
        }
    }

    private void HandleAdminExit(string? pin)
    {
        if (!_cfg.AdminExitEnabled)
        {
            _log.LogWarning("admin-exit ignored: no PIN configured");
            return;
        }
        if (VerifyPin(pin))
        {
            _log.LogWarning("admin-exit: correct PIN — entering maintenance until the player signs out");
            _maintenance = true;
            _watchdog.Stop();
            _ipc.Publish(MaintenanceView());
            _ = _api.ReportEventAsync("admin_exit", "maintenance unlocked via PIN", CancellationToken.None);
        }
        else
        {
            _log.LogWarning("admin-exit: WRONG PIN");
            _ = _api.ReportEventAsync("admin_exit_failed", "wrong admin PIN", CancellationToken.None);
        }
    }

    private bool VerifyPin(string? pin)
    {
        if (string.IsNullOrEmpty(pin)) return false;
        var got = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(pin))).ToLowerInvariant();
        var want = _cfg.AdminExitPinHash.Trim().ToLowerInvariant();
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(got), Encoding.UTF8.GetBytes(want));
    }

    private KioskView Stamp(KioskView v) => v with { AdminExitEnabled = _cfg.AdminExitEnabled };
    private void PublishView(KioskView v) => _ipc.Publish(Stamp(v));

    // Wake the main loop out of its inter-poll sleep so it re-polls immediately. Safe to call
    // from the IPC thread; races against loop teardown are swallowed.
    private void Poke()
    {
        try { _wakeCts?.Cancel(); }
        catch (ObjectDisposedException) { /* loop already moved on */ }
    }

    private KioskView MaintenanceView() => new()
    {
        Mode = KioskMode.Maintenance,
        Online = true,
        SeatNumber = _cfg.SeatNumber,
        Message = "Режим обслуживания — защита вернётся при следующем входе",
        AdminExitEnabled = _cfg.AdminExitEnabled,
    };
}
