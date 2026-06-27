using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using StopkekAgent.Config;

namespace StopkekAgent.Watchdog;

/// <summary>
/// Anti-tamper failsafe for the player-session shell.
///
/// The shell (the visible lock/overlay) is launched by a per-user logon task and runs in
/// the PLAYER's interactive session. The agent runs as SYSTEM in Session 0 and CANNOT draw
/// on the player's desktop (Session 0 isolation), so the watchdog must never try to launch
/// the shell itself: a SYSTEM-started shell renders invisibly in Session 0 and — worse —
/// grabs the single-client IPC pipe, so the real player-session shell can never connect and
/// the overlay never appears. (That was the original bug.)
///
/// Instead the watchdog watches the live IPC connection. Once the shell has connected, if the
/// pipe stays down past a short grace (the player killed the overlay), we secure the seat by
/// disconnecting the interactive session to the Windows logon screen — killing the UI must
/// never equal free play. The logon task relaunches the shell on the next sign-in, which
/// reconnects and re-arms the watchdog.
/// </summary>
public sealed class ShellWatchdog
{
    private readonly KioskConfig _cfg;
    private readonly ILogger _log;

    private bool _armed;                          // shell has connected at least once this cycle
    private DateTime _downSince = DateTime.MinValue;

    // How long the shell may be gone before we treat it as tamper and secure the seat.
    // Long enough to ride out a normal agent/shell restart, short enough that free play is brief.
    private static readonly TimeSpan DownGrace = TimeSpan.FromSeconds(15);

    public ShellWatchdog(KioskConfig cfg, ILogger log)
    {
        _cfg = cfg;
        _log = log;
    }

    public bool Enabled => _cfg.WatchdogEnabled;

    /// <summary>
    /// Called every tick with the live IPC connection state. Returns true if it had to
    /// secure the seat (so the caller can report a tamper event).
    /// </summary>
    public bool Tick(bool shellConnected)
    {
        if (!Enabled) return false;

        if (shellConnected)
        {
            _armed = true;
            _downSince = DateTime.MinValue;
            return false;
        }

        // Not connected. Until the shell has connected at least once (e.g. before the player
        // signs in after boot) there is nothing to protect yet — stay quiet.
        if (!_armed) return false;

        if (_downSince == DateTime.MinValue)
        {
            _downSince = DateTime.UtcNow;
            return false;
        }
        if (DateTime.UtcNow - _downSince < DownGrace) return false;

        // The overlay was up and then vanished past the grace window -> secure the seat.
        bool secured = SecureSeat();
        // Disarm: require a fresh connection before we can act again, so the session bouncing
        // back to the logon screen can't trigger a disconnect loop.
        _armed = false;
        _downSince = DateTime.MinValue;
        return secured;
    }

    /// <summary>Drop the active interactive session to the secure Windows logon screen.</summary>
    private bool SecureSeat()
    {
        try
        {
            uint session = WTSGetActiveConsoleSessionId();
            if (session == 0xFFFFFFFF)
            {
                _log.LogWarning("watchdog: no active console session to secure");
                return false;
            }
            if (!WTSDisconnectSession(WTS_CURRENT_SERVER_HANDLE, session, bWait: true))
            {
                _log.LogError("watchdog: WTSDisconnectSession failed, err={Err}",
                    Marshal.GetLastWin32Error());
                return false;
            }
            _log.LogWarning("watchdog: shell gone past grace — disconnected session {Sid} to secure the seat", session);
            return true;
        }
        catch (Exception ex)
        {
            _log.LogError("watchdog: secure-seat error: {Msg}", ex.Message);
            return false;
        }
    }

    /// <summary>Kept for symmetry with the worker lifecycle; nothing to tear down.</summary>
    public void Stop() { }

    private static readonly IntPtr WTS_CURRENT_SERVER_HANDLE = IntPtr.Zero;

    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSDisconnectSession(IntPtr hServer, uint sessionId, bool bWait);
}
