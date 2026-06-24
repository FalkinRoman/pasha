using System.Diagnostics;
using Microsoft.Extensions.Logging;
using StopkekAgent.Config;

namespace StopkekAgent.Watchdog;

/// <summary>
/// Keeps the shell UI alive. If the shell process dies (crash, or a user trying to
/// kill the overlay), we relaunch it. While the shell is missing we lock the
/// workstation so there is never an unguarded gap — killing the UI must never equal
/// free play. No-op until ShellPath is configured (shell ships in Phase 2).
/// </summary>
public sealed class ShellWatchdog
{
    private readonly KioskConfig _cfg;
    private readonly ILogger _log;
    private Process? _proc;
    private DateTime _lastLaunch = DateTime.MinValue;

    public ShellWatchdog(KioskConfig cfg, ILogger log)
    {
        _cfg = cfg;
        _log = log;
    }

    public bool Enabled => _cfg.WatchdogEnabled && !string.IsNullOrWhiteSpace(_cfg.ShellPath);

    public bool ShellAlive => _proc is { HasExited: false };

    /// <summary>Called every tick. Returns true if the shell had to be (re)launched.</summary>
    public bool Tick()
    {
        if (!Enabled) return false;
        if (ShellAlive) return false;

        // Throttle relaunch storms (e.g. shell crashing on startup).
        if (DateTime.UtcNow - _lastLaunch < TimeSpan.FromSeconds(3)) return false;

        try
        {
            if (!File.Exists(_cfg.ShellPath))
            {
                _log.LogError("shell not found at {Path}", _cfg.ShellPath);
                return false;
            }
            _lastLaunch = DateTime.UtcNow;
            _proc = Process.Start(new ProcessStartInfo
            {
                FileName = _cfg.ShellPath,
                UseShellExecute = true,
            });
            _log.LogWarning("shell (re)launched, pid={Pid}", _proc?.Id);
            return true;
        }
        catch (Exception ex)
        {
            _log.LogError("failed to launch shell: {Msg}", ex.Message);
            return false;
        }
    }

    public void Stop()
    {
        try
        {
            if (_proc is { HasExited: false })
                _proc.Kill(entireProcessTree: true);
        }
        catch { /* ignore */ }
    }
}
