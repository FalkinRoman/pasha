using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StopkekAgent;
using StopkekAgent.Api;
using StopkekAgent.Config;
using StopkekAgent.Core;
using StopkekAgent.Logging;
using StopkekAgent.Watchdog;

// config.json sits next to the executable so each PC is configured without a rebuild.
var exeDir = AppContext.BaseDirectory;
var configPath = Path.Combine(exeDir, "config.json");

KioskConfig cfg;
try
{
    cfg = KioskConfig.Load(configPath);
}
catch (Exception ex)
{
    // Without valid config the agent must NOT silently run unlocked. Fail loudly.
    await Console.Error.WriteLineAsync($"[stopkek-agent] config error: {ex.Message}");
    Environment.ExitCode = 2;
    return;
}

var builder = Host.CreateApplicationBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o => o.TimestampFormat = "HH:mm:ss ");
builder.Logging.AddProvider(new FileLoggerProvider());
builder.Logging.SetMinimumLevel(LogLevel.Information);
// Quiet the noisy per-request HttpClient pipeline logs; keep our own.
builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.Extensions.Http", LogLevel.Warning);

builder.Services.AddSingleton(cfg);
builder.Services.AddHttpClient<KioskApiClient>();
builder.Services.AddSingleton<SessionStateMachine>(sp =>
    new SessionStateMachine(cfg, sp.GetRequiredService<ILogger<SessionStateMachine>>()));
builder.Services.AddSingleton<ShellWatchdog>(sp =>
    new ShellWatchdog(cfg, sp.GetRequiredService<ILogger<ShellWatchdog>>()));
builder.Services.AddHostedService<Worker>();

await builder.Build().RunAsync();
