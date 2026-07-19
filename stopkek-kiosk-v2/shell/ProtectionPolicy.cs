using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace StopkekShell;

/// <summary>
/// Applies / removes the player's kiosk restrictions (Task Manager, regedit, Run,
/// Control Panel, Win+L, Change Password) in the player's OWN HKCU policy hive.
///
/// Written through the .NET registry API, which — unlike reg.exe / regedit — is NOT
/// gated by the DisableRegistryTools policy, so <see cref="Disable"/> works even while
/// the restrictions are already on (that is exactly why the old unlock.cmd, which used
/// reg.exe, failed with "access denied"). The shell runs as the limited <c>player</c>
/// user and writes only its own HKCU, so no admin / UAC is involved.
///
/// Lifecycle (see ShellController): Enable on Start and in the Locked / Active / Grace
/// modes; Disable only when the admin drops the overlay into Maintenance (crest + PIN).
/// A reboot / re-login restarts the shell, which re-applies on Start — self-restoring.
/// </summary>
internal static class ProtectionPolicy
{
    private const string SysKey = @"Software\Microsoft\Windows\CurrentVersion\Policies\System";
    private const string ExpKey = @"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer";

    private static readonly string[] SysValues =
        { "DisableTaskMgr", "DisableRegistryTools", "DisableLockWorkstation", "DisableChangePassword" };
    private static readonly string[] ExpValues =
        { "NoRun", "NoControlPanel" };

    /// <summary>Turn the restrictions ON (all policy values = 1).</summary>
    public static void Enable() => Set(1);

    /// <summary>Turn the restrictions OFF (all policy values = 0).</summary>
    public static void Disable() => Set(0);

    private static void Set(int value)
    {
        try
        {
            using (var k = Registry.CurrentUser.CreateSubKey(SysKey))
                foreach (var name in SysValues) k!.SetValue(name, value, RegistryValueKind.DWord);
            using (var k = Registry.CurrentUser.CreateSubKey(ExpKey))
                foreach (var name in ExpValues) k!.SetValue(name, value, RegistryValueKind.DWord);

            Broadcast();
            ShellLog.Write($"ProtectionPolicy: set restrictions = {value}");
        }
        catch (Exception ex)
        {
            ShellLog.Write("ProtectionPolicy FAILED: " + ex);
        }
    }

    // Make Explorer re-read NoRun / NoControlPanel without a sign-out. Best-effort:
    // HWND_BROADCAST, WM_SETTINGCHANGE with lParam "Policy", abort-if-hung, 2s cap.
    private static void Broadcast()
    {
        try { SendMessageTimeout((IntPtr)0xffff, 0x1A, IntPtr.Zero, "Policy", 2, 2000, out _); }
        catch { /* broadcast is optional; the policy values are already written */ }
    }

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr SendMessageTimeout(
        IntPtr hWnd, int msg, IntPtr wParam, string lParam, int flags, int timeout, out IntPtr result);
}
