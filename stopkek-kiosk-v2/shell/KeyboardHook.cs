using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Input;

namespace StopkekShell;

/// <summary>
/// Low-level keyboard hook that swallows escape combos (Win, Alt+Tab, Alt+F4,
/// Ctrl+Esc, Alt+Esc) while the lock is up. Enabled ONLY in LOCKED — during play
/// we never trap keys, so games are unaffected. Note: it cannot catch Ctrl+Alt+Del
/// (secure attention sequence); that is handled by the Phase-0 policy DisableLockWorkstation
/// plus the restricted account.
/// </summary>
public sealed class KeyboardHook : IDisposable
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100, WM_SYSKEYDOWN = 0x0104;

    private const int VK_TAB = 0x09, VK_ESCAPE = 0x1B, VK_F4 = 0x73;
    private const int VK_LWIN = 0x5B, VK_RWIN = 0x5C;

    private delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
    private readonly HookProc _proc;
    private IntPtr _hook = IntPtr.Zero;

    public KeyboardHook() => _proc = HookCallback;

    public bool Enabled { get; private set; }

    public void Enable()
    {
        if (Enabled) return;
        using var module = Process.GetCurrentProcess().MainModule!;
        _hook = SetWindowsHookEx(WH_KEYBOARD_LL, _proc,
            GetModuleHandle(module.ModuleName), 0);
        Enabled = _hook != IntPtr.Zero;
    }

    public void Disable()
    {
        if (_hook != IntPtr.Zero) { UnhookWindowsHookEx(_hook); _hook = IntPtr.Zero; }
        Enabled = false;
    }

    private IntPtr HookCallback(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0 && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN))
        {
            int vk = Marshal.ReadInt32(lParam);
            bool alt = (Keyboard.Modifiers & ModifierKeys.Alt) != 0
                       || (GetAsyncKeyState(0x12) & 0x8000) != 0; // VK_MENU
            bool ctrl = (GetAsyncKeyState(0x11) & 0x8000) != 0;   // VK_CONTROL

            bool block =
                vk is VK_LWIN or VK_RWIN ||
                (alt && vk == VK_TAB) ||
                (alt && vk == VK_F4) ||
                (alt && vk == VK_ESCAPE) ||
                (ctrl && vk == VK_ESCAPE);

            if (block) return (IntPtr)1; // swallow
        }
        return CallNextHookEx(_hook, code, wParam, lParam);
    }

    public void Dispose() => Disable();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);
}
