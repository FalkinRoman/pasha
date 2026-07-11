using System.Diagnostics;
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
    private ToastWindow? _toast;
    private string? _lastToastId;
    private readonly VoiceAnnouncer _voice = new();

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
                // Was a paid session just ended (time ran out / grace expired / "end session")?
                // If so we clean the seat for the next customer; a boot-time lock must not.
                var fromSession = _mode is KioskMode.Active or KioskMode.Grace;
                if (changed) EnterLocked(fromSession);
                foreach (var w in _locks) w.UpdateView(view);
                break;

            case KioskMode.Active:
            case KioskMode.Grace:
                if (changed) EnterUnlocked();
                // First slip into grace = the paid time just ran out — say it out loud.
                if (changed && view.Mode == KioskMode.Grace && !_preview) _voice.Announce("time-up");
                EnsureWidget();
                _widget!.UpdateView(view);
                break;

            case KioskMode.Maintenance:
                // Admin unlocked the PC for servicing: drop the hook and hide everything.
                if (changed) { _hook.Disable(); foreach (var w in _locks) w.Hide(); _widget?.Hide(); }
                break;
        }
        _mode = view.Mode;

        // Toasts are independent of mode: show one whenever the agent hands us a new id.
        MaybeShowToast(view);
    }

    // The agent carries a one-shot toast inside every KioskView snapshot. It keeps
    // the same ToastId across polls until a new toast is queued, so we fire exactly
    // once per id — over the game (Active) or over the lock screen (test push).
    private void MaybeShowToast(KioskView view)
    {
        if (_preview) return;
        var id = view.ToastId;
        if (string.IsNullOrEmpty(id) || id == _lastToastId) return;
        _lastToastId = id;
        if (string.IsNullOrEmpty(view.ToastText)) return;

        try { _toast?.Close(); } catch { /* already gone */ }
        var w = new ToastWindow(view.ToastText);
        _toast = w;
        w.Closed += (_, _) => { if (ReferenceEquals(_toast, w)) _toast = null; };
        w.Show();
        ShellLog.Write($"toast shown: {view.ToastText}");

        // Time-warning toasts arrive from the API with id "warn-<bookingId>-<mins>"
        // (mins is 15/5/1) — voice the matching clip. No server change needed.
        AnnounceWarn(id);
    }

    private void AnnounceWarn(string toastId)
    {
        if (!toastId.StartsWith("warn-", StringComparison.Ordinal)) return;
        var mins = toastId[(toastId.LastIndexOf('-') + 1)..];
        if (mins is "15" or "5" or "1") _voice.Announce($"time-{mins}");
    }

    private void EnterLocked(bool fromSession)
    {
        // Pull the player out of any fullscreen game, then raise the locks.
        if (!_preview)
        {
            MinimiseForeground();
            // A real session end (not a boot-time lock) closes everything the
            // player opened, so the next customer starts from a clean desktop.
            if (fromSession) TerminatePlayerApps();
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

    // Processes we must never kill or the session/desktop breaks. Names are the
    // Process.ProcessName form (no .exe), compared case-insensitively.
    private static readonly HashSet<string> KeepAlive = new(StringComparer.OrdinalIgnoreCase)
    {
        "explorer", "stopkek-shell",
        "dwm", "winlogon", "csrss", "wininit", "services", "lsass", "smss",
        "sihost", "ctfmon", "fontdrvhost", "taskhostw", "runtimebroker",
        "searchhost", "startmenuexperiencehost", "shellexperiencehost",
        "textinputhost", "applicationframehost", "dllhost", "conhost", "svchost",
    };

    /// <summary>
    /// Close every app the player launched in THIS interactive session. The shell
    /// runs as the limited <c>player</c> user, so Kill only succeeds on that user's
    /// own processes — a natural blast-radius fence. System/desktop processes are
    /// whitelisted; anything else (games, launchers, browsers) is terminated.
    /// </summary>
    private void TerminatePlayerApps()
    {
        int mySession;
        int myPid = Environment.ProcessId;
        try { mySession = Process.GetCurrentProcess().SessionId; }
        catch { return; }

        int killed = 0;
        foreach (var p in Process.GetProcesses())
        {
            try
            {
                if (p.Id == myPid || p.SessionId != mySession) continue;
                if (KeepAlive.Contains(p.ProcessName)) continue;
                p.Kill(entireProcessTree: true);
                killed++;
            }
            catch { /* protected/exited/not-ours — leave it */ }
            finally { p.Dispose(); }
        }
        ShellLog.Write($"TerminatePlayerApps: killed {killed} process(es) in session {mySession}");
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
        _toast?.Close();
    }

    private const int SW_FORCEMINIMIZE = 11;
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
