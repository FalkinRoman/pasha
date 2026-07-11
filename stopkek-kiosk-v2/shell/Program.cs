using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using StopkekShell.Ipc;

namespace StopkekShell;

public static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        InstallCrashLogging();

        // "Запустить от stopKEK": elevate-a-program mode. Not the overlay — talk to the agent
        // over the elevation pipe and exit. Must be handled before any overlay/app setup.
        if (args.Contains("--run", StringComparer.OrdinalIgnoreCase))
        {
            ShellLog.Write("shell --run (elevate mode)");
            return ElevateClient.Run(args);
        }

        // Per-monitor DPI awareness MUST be set before any window so WPF layout (DIP)
        // and our SetWindowPos (physical px) agree; otherwise content is laid out for a
        // scaled-too-wide surface and clips off-screen. Manifest is unreliable here
        // because UseWindowsForms overrides it, so set it programmatically.
        TrySetPerMonitorDpiAware();

        bool mock = args.Contains("--mock", StringComparer.OrdinalIgnoreCase);
        // Safe preview: fullscreen but Esc-closable, not topmost, no keyboard hook. Implies mock.
        bool preview = args.Contains("--preview", StringComparer.OrdinalIgnoreCase);
        if (preview) mock = true;

        ShellLog.Write($"shell start. pid={Environment.ProcessId} session={Process_SessionId()} mock={mock} preview={preview}");

        var app = new Application
        {
            ShutdownMode = preview ? ShutdownMode.OnLastWindowClose : ShutdownMode.OnExplicitShutdown,
        };
        app.DispatcherUnhandledException += OnDispatcherUnhandled;

        IViewSource source = mock ? new MockViewSource() : new AgentIpcClient();
        var controller = new ShellController(source, preview);

        app.Startup += (_, _) => controller.Start();
        app.Exit += (_, _) => { ShellLog.Write("shell exit"); controller.Dispose(); };

        try
        {
            return app.Run();
        }
        catch (Exception ex)
        {
            ShellLog.Write("FATAL app.Run: " + ex);
            throw;
        }
    }

    // The shell crashing silently is the worst case (login looks like "nothing happened").
    // Funnel every unhandled-exception channel into shell.log so the next login is diagnosable.
    private static void InstallCrashLogging()
    {
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
            ShellLog.Write("FATAL AppDomain.UnhandledException: " + (e.ExceptionObject as Exception)?.ToString());
        TaskScheduler.UnobservedTaskException += (_, e) =>
            { ShellLog.Write("UnobservedTaskException: " + e.Exception); e.SetObserved(); };
    }

    // A rendering exception on the UI thread would otherwise kill the shell silently. Log it;
    // do not mark handled, so behaviour (and the watchdog's view of a dead shell) is unchanged.
    private static void OnDispatcherUnhandled(object sender, DispatcherUnhandledExceptionEventArgs e)
        => ShellLog.Write("FATAL DispatcherUnhandledException: " + e.Exception);

    private static int Process_SessionId()
    {
        try { return System.Diagnostics.Process.GetCurrentProcess().SessionId; }
        catch { return -1; }
    }

    private static void TrySetPerMonitorDpiAware()
    {
        try { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); }
        catch { /* pre-1703 Windows: best effort */ }
    }

    private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = (IntPtr)(-4);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
}
