using System.Runtime.InteropServices;
using System.Windows;
using StopkekShell.Ipc;

namespace StopkekShell;

public static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        // Per-monitor DPI awareness MUST be set before any window so WPF layout (DIP)
        // and our SetWindowPos (physical px) agree; otherwise content is laid out for a
        // scaled-too-wide surface and clips off-screen. Manifest is unreliable here
        // because UseWindowsForms overrides it, so set it programmatically.
        TrySetPerMonitorDpiAware();

        bool mock = args.Contains("--mock", StringComparer.OrdinalIgnoreCase);
        // Safe preview: fullscreen but Esc-closable, not topmost, no keyboard hook. Implies mock.
        bool preview = args.Contains("--preview", StringComparer.OrdinalIgnoreCase);
        if (preview) mock = true;

        var app = new Application
        {
            ShutdownMode = preview ? ShutdownMode.OnLastWindowClose : ShutdownMode.OnExplicitShutdown,
        };

        IViewSource source = mock ? new MockViewSource() : new AgentIpcClient();
        var controller = new ShellController(source, preview);

        app.Startup += (_, _) => controller.Start();
        app.Exit += (_, _) => controller.Dispose();

        return app.Run();
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
