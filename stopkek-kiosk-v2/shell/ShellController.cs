using System.Runtime.InteropServices;
using System.Windows;
using StopkekShell.Ipc;
using Forms = System.Windows.Forms;

namespace StopkekShell;

/// <summary>
/// Turns a stream of KioskView updates into on-screen windows, on the UI thread:
///   LOCKED -> lock window on every monitor + keyboard hook + minimise the game.
///   ACTIVE -> hide locks, drop the hook, show the timer widget.
///   GRACE  -> game stays visible, timer widget becomes a "time's up" banner.
/// </summary>
public sealed class ShellController : IDisposable
{
    private readonly IViewSource _source;
    private readonly KeyboardHook _hook = new();
    private readonly List<LockWindow> _locks = new();
    private readonly bool _preview;
    private TimerWidget? _widget;

    private KioskMode? _mode;
    private bool _disposed;

    public ShellController(IViewSource source, bool preview = false)
    {
        _source = source;
        _preview = preview;
        _source.ViewUpdated += OnViewUpdated;
    }

    public void Start() => _source.Start();

    private void OnViewUpdated(KioskView view)
    {
        var disp = Application.Current?.Dispatcher;
        if (disp is null) return;
        if (disp.CheckAccess()) Apply(view);
        else disp.BeginInvoke(() => Apply(view));
    }

    private void Apply(KioskView view)
    {
        if (_disposed) return;
        var changed = _mode != view.Mode;
        if (changed) ShellLog.Write($"apply: mode {_mode?.ToString() ?? "none"} -> {view.Mode}");

        switch (view.Mode)
        {
            case KioskMode.Locked:
                if (changed) EnterLocked();
                foreach (var w in _locks) w.UpdateView(view);
                break;

            case KioskMode.Active:
            case KioskMode.Grace:
                if (changed) EnterUnlocked();
                EnsureWidget();
                _widget!.UpdateView(view);
                break;

            case KioskMode.Maintenance:
                // Admin unlocked the PC for servicing: drop the hook and hide everything.
                if (changed) { _hook.Disable(); foreach (var w in _locks) w.Hide(); _widget?.Hide(); }
                break;
        }
        _mode = view.Mode;
    }

    private void EnterLocked()
    {
        // Pull the player out of any fullscreen game, then raise the locks.
        if (!_preview)
        {
            MinimiseForeground();
            _hook.Enable();
        }
        EnsureLockWindows();
        foreach (var w in _locks)
        {
            w.Show();
            if (!_preview) { w.Topmost = true; w.Activate(); }
        }
        _widget?.Hide();
        ShellLog.Write($"EnterLocked: {_locks.Count} lock window(s) shown");
    }

    private void EnterUnlocked()
    {
        _hook.Disable();
        foreach (var w in _locks) w.Hide();
    }

    private void EnsureLockWindows()
    {
        if (_locks.Count > 0) return;
        if (_preview)
        {
            // One windowed lock for safe visual preview.
            _locks.Add(new LockWindow(Forms.Screen.PrimaryScreen!, isPrimary: true, preview: true, onAdminPin: OnAdminPin));
            return;
        }
        var primary = Forms.Screen.PrimaryScreen;
        foreach (var screen in Forms.Screen.AllScreens)
        {
            var w = new LockWindow(screen, isPrimary: screen.Equals(primary), onAdminPin: OnAdminPin);
            _locks.Add(w);
        }
    }

    // Lock screen collected an admin PIN; hand it to the agent, which validates and
    // (on success) flips to Maintenance — the shell then hides via the normal view path.
    private void OnAdminPin(string pin) => _source.SendAdminExit(pin);

    private void EnsureWidget() => _widget ??= new TimerWidget(() => _source.SendCommand("end-session"));

    private static void MinimiseForeground()
    {
        var fg = GetForegroundWindow();
        if (fg != IntPtr.Zero) ShowWindow(fg, SW_FORCEMINIMIZE);
    }

    public void Dispose()
    {
        _disposed = true;
        _source.ViewUpdated -= OnViewUpdated;
        _hook.Dispose();
        _source.Dispose();
        foreach (var w in _locks) w.Close();
        _widget?.Close();
    }

    private const int SW_FORCEMINIMIZE = 11;
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
