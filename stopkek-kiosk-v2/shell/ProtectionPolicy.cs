using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
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

    /// <summary>
    /// Turn the restrictions OFF (all policy values = 0) and make them take effect NOW.
    ///
    /// DisableTaskMgr / DisableRegistryTools / DisableLockWorkstation / DisableChangePassword are
    /// re-read by Windows on every use, so writing 0 lifts them immediately. NoRun / NoControlPanel,
    /// however, are cached by the RUNNING explorer.exe: a WM_SETTINGCHANGE broadcast is not enough to
    /// make it drop them (Control Panel / Settings / Run stayed blocked after the crest+PIN exit — the
    /// bug we are fixing). Restarting the player's own explorer forces a clean re-read, so ALL six
    /// restrictions are actually gone once maintenance begins.
    /// </summary>
    public static void Disable()
    {
        Set(0);
        RestartExplorer();
    }

    // Kill + relaunch explorer.exe ONLY in the shell's own interactive session, so the running
    // Explorer re-reads NoRun / NoControlPanel. Scoped by SessionId (same fence as
    // ShellController.TerminatePlayerApps) so an admin's explorer in another session is untouched.
    private static void RestartExplorer()
    {
        try
        {
            int mySession = Process.GetCurrentProcess().SessionId;

            bool killedAny = false;
            foreach (var p in Process.GetProcessesByName("explorer"))
            {
                try
                {
                    if (p.SessionId == mySession) { p.Kill(); killedAny = true; }
                }
                catch { /* protected / already gone — skip */ }
                finally { p.Dispose(); }
            }

            if (!killedAny) return; // nothing to refresh in our session

            // Windows normally relaunches the shell explorer on its own; give it a moment and,
            // if it did not come back in our session, start it explicitly.
            Thread.Sleep(700);
            bool alive = false;
            foreach (var p in Process.GetProcessesByName("explorer"))
            {
                try { if (p.SessionId == mySession) alive = true; }
                catch { }
                finally { p.Dispose(); }
            }
            if (!alive)
                Process.Start(new ProcessStartInfo("explorer.exe") { UseShellExecute = true });

            ShellLog.Write("ProtectionPolicy: restarted explorer to refresh NoRun/NoControlPanel");
        }
        catch (Exception ex)
        {
            ShellLog.Write("ProtectionPolicy RestartExplorer FAILED: " + ex);
        }
    }

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
