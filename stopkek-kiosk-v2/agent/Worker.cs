using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StopkekAgent.Api;
using StopkekAgent.Config;
using StopkekAgent.Core;
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
    private readonly Stopwatch _clock = Stopwatch.StartNew();

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
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation(
            "stopkek-agent up. seat={Seat} api={Api} poll={Poll}s grace={Grace}s",
            _cfg.SeatNumber, _cfg.ApiUrl, _cfg.PollIntervalSec, _cfg.GraceSeconds);

        _ipc.Start(stoppingToken);

        // Publish the fail-secure boot view immediately.
        _ipc.Publish(_machine.Current);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var poll = await _api.GetStateAsync(stoppingToken);
                var view = _machine.Apply(poll, _clock.ElapsedMilliseconds);
                _ipc.Publish(view);

                if (_watchdog.Tick())
                {
                    // Shell had to be relaunched — likely a tamper attempt. Flag it.
                    _ = _api.ReportEventAsync("shell_relaunched",
                        "watchdog restarted the UI", CancellationToken.None);
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

            try { await Task.Delay(delay, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        _watchdog.Stop();
        await _ipc.DisposeAsync();
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
                break;

            case ShellCommand.Hello:
                _ipc.Publish(_machine.Current); // re-send current view on demand
                break;
        }
    }
}
