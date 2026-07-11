using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using StopkekAgent.Config;

namespace StopkekAgent.Elevation;

/// <summary>
/// Runs programs "as administrator" WITHOUT the player typing a password.
///
/// The player account is a standard (non-admin) user, so Windows cannot elevate an app
/// for it via any registry setting — elevation always needs an admin identity. Instead a
/// dedicated hidden local admin account is created at install time; its password lives in
/// the ACL-locked config.json (SYSTEM/Admins only), so the player never sees it.
///
/// The agent runs as SYSTEM in Session 0. On request it launches the target exe under the
/// hidden admin's full (elevated) token, but placed in the player's interactive session so
/// the window appears on the player's desktop. The trigger comes over a dedicated multi-
/// client pipe (the shell's control pipe is single-client and already taken by the overlay):
/// the shell in "--run" mode connects, sends {path,args}, and we reply {ok,error?}.
///
/// A blocklist rejects system shells / admin tools (cmd, powershell, regedit, taskmgr, ...)
/// so this stays a "run my game/installer as admin" tool rather than a general break-out.
/// </summary>
public sealed class ElevationServer : IAsyncDisposable
{
    private readonly string _user;
    private readonly string _password;
    private readonly ILogger _log;

    private CancellationTokenSource? _cts;
    private Task? _loop;

    // System shells and admin utilities the player must not launch elevated. Matched on the
    // file name without extension, case-insensitive.
    private static readonly HashSet<string> Blocked = new(StringComparer.OrdinalIgnoreCase)
    {
        "cmd", "powershell", "pwsh", "powershell_ise", "regedit", "taskmgr", "mmc",
        "control", "reg", "sc", "net", "net1", "cscript", "wscript", "mshta", "rundll32",
        "gpedit", "secpol", "lusrmgr", "compmgmt", "services", "msconfig", "regsvr32",
        "wmic", "bcdedit", "dism", "netsh", "schtasks", "at",
    };

    private const string PipeName = "stopkek-kiosk-elevate";

    public ElevationServer(string user, string password, ILogger log)
    {
        _user = user;
        _password = password;
        _log = log;
    }

    public void Start(CancellationToken appStopping)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(appStopping);
        _loop = Task.Run(() => AcceptLoopAsync(_cts.Token));
        _log.LogInformation("elevation server up (user={User})", _user);
    }

    private async Task AcceptLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var server = NamedPipeServerStreamAcl.Create(
                    PipeName,
                    PipeDirection.InOut,
                    maxNumberOfServerInstances: NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous,
                    inBufferSize: 4096,
                    outBufferSize: 4096,
                    BuildPipeAcl());

                await server.WaitForConnectionAsync(ct);
                await ServeAsync(server, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning("elevate accept error: {Msg}", ex.Message);
                try { await Task.Delay(500, ct); } catch { break; }
            }
        }
    }

    private async Task ServeAsync(NamedPipeServerStream pipe, CancellationToken ct)
    {
        // Bound a single request so a client that connects but never sends can't wedge the loop.
        using var reqCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        reqCts.CancelAfter(TimeSpan.FromSeconds(15));

        var reader = new StreamReader(pipe, Encoding.UTF8);
        var writer = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true };

        string? line;
        try { line = await reader.ReadLineAsync(reqCts.Token); }
        catch (OperationCanceledException) { return; }
        if (string.IsNullOrWhiteSpace(line)) return;

        ElevateRequest? req;
        try { req = JsonSerializer.Deserialize<ElevateRequest>(line, Json); }
        catch (JsonException) { await Reply(writer, false, "bad request"); return; }

        var (ok, error) = TryLaunch(req?.Path, req?.Args);
        await Reply(writer, ok, error);
    }

    private static async Task Reply(StreamWriter writer, bool ok, string? error)
    {
        try { await writer.WriteLineAsync(JsonSerializer.Serialize(new ElevateReply { Ok = ok, Error = error }, Json)); }
        catch { /* client gone — nothing to do */ }
    }

    private (bool ok, string? error) TryLaunch(string? path, string? args)
    {
        if (string.IsNullOrWhiteSpace(path))
            return (false, "Не указан путь к программе.");

        string full;
        try { full = Path.GetFullPath(path.Trim().Trim('"')); }
        catch { return (false, "Некорректный путь."); }

        if (!File.Exists(full))
        {
            _log.LogWarning("elevate: file not found: {Path}", full);
            return (false, "Файл не найден.");
        }

        var name = Path.GetFileNameWithoutExtension(full);
        if (Blocked.Contains(name))
        {
            _log.LogWarning("elevate: BLOCKED {Name} ({Path})", name, full);
            return (false, "Эту программу нельзя запускать от администратора.");
        }

        try
        {
            LaunchAsHiddenAdmin(full, args);
            _log.LogWarning("elevate: launched {Path} as {User}", full, _user);
            return (true, null);
        }
        catch (Exception ex)
        {
            _log.LogError("elevate: launch failed for {Path}: {Msg}", full, ex.Message);
            return (false, "Не удалось запустить: " + ex.Message);
        }
    }

    /// <summary>
    /// Log the hidden admin on, retarget the token to the active console session, and start
    /// the process on the player's desktop. SYSTEM holds the privileges (SeTcb/SeAssignPrimaryToken)
    /// this needs. Throws on any Win32 failure with the last error.
    /// </summary>
    private void LaunchAsHiddenAdmin(string exePath, string? args)
    {
        uint session = WTSGetActiveConsoleSessionId();
        if (session == 0xFFFFFFFF)
            throw new InvalidOperationException("нет активной пользовательской сессии");

        IntPtr hToken = IntPtr.Zero, hFull = IntPtr.Zero, hDup = IntPtr.Zero, env = IntPtr.Zero;
        try
        {
            if (!LogonUser(_user, ".", _password, LOGON32_LOGON_INTERACTIVE,
                    LOGON32_PROVIDER_DEFAULT, out hToken))
                throw Win32("LogonUser", Marshal.GetLastWin32Error());

            // With UAC on, an interactive logon of an admin yields the FILTERED token — a process
            // started from it runs as stopkek-svc but without admin rights, which defeats the
            // point. The unfiltered token hangs off it as TokenLinkedToken; use that when present.
            hFull = TryGetLinkedToken(hToken);

            var sa = new SECURITY_ATTRIBUTES { nLength = Marshal.SizeOf<SECURITY_ATTRIBUTES>() };
            if (!DuplicateTokenEx(hFull != IntPtr.Zero ? hFull : hToken, TOKEN_ALL_ACCESS, ref sa,
                    SecurityIdentification: 2 /* SecurityImpersonation */, TokenType: 1 /* TokenPrimary */,
                    out hDup))
                throw Win32("DuplicateTokenEx", Marshal.GetLastWin32Error());

            // Move the token into the interactive session so the window shows on the player's desktop.
            if (!SetTokenInformation(hDup, TokenSessionId: 12, ref session, sizeof(uint)))
                throw Win32("SetTokenInformation", Marshal.GetLastWin32Error());

            if (!CreateEnvironmentBlock(out env, hDup, bInherit: false))
                env = IntPtr.Zero; // best effort — fall back to the default environment

            var si = new STARTUPINFO
            {
                cb = Marshal.SizeOf<STARTUPINFO>(),
                lpDesktop = @"winsta0\default",
            };

            var cmd = string.IsNullOrWhiteSpace(args) ? $"\"{exePath}\"" : $"\"{exePath}\" {args}";
            var workDir = Path.GetDirectoryName(exePath);

            if (!CreateProcessAsUser(hDup, null, cmd, IntPtr.Zero, IntPtr.Zero, false,
                    CREATE_UNICODE_ENVIRONMENT, env, workDir, ref si, out var pi))
                throw Win32("CreateProcessAsUser", Marshal.GetLastWin32Error());

            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
        }
        finally
        {
            if (env != IntPtr.Zero) DestroyEnvironmentBlock(env);
            if (hDup != IntPtr.Zero) CloseHandle(hDup);
            if (hFull != IntPtr.Zero) CloseHandle(hFull);
            if (hToken != IntPtr.Zero) CloseHandle(hToken);
        }
    }

    /// <summary>
    /// The full (unfiltered) admin token linked to a UAC-filtered one, or zero if the token is
    /// not filtered (UAC off, or the linked token is unavailable) — caller then uses it as-is.
    /// </summary>
    private IntPtr TryGetLinkedToken(IntPtr token)
    {
        var buf = Marshal.AllocHGlobal(sizeof(int));
        try
        {
            if (!GetTokenInformation(token, TokenElevationType, buf, sizeof(int), out _))
                return IntPtr.Zero;
            if (Marshal.ReadInt32(buf) != TokenElevationTypeLimited)
                return IntPtr.Zero; // already full (UAC off / not a filtered admin)
        }
        finally { Marshal.FreeHGlobal(buf); }

        var linkedBuf = Marshal.AllocHGlobal(IntPtr.Size);
        try
        {
            if (!GetTokenInformation(token, TokenLinkedToken, linkedBuf, IntPtr.Size, out _))
            {
                _log.LogWarning("elevate: linked token unavailable (Win32 {Err}) — running filtered",
                    Marshal.GetLastWin32Error());
                return IntPtr.Zero;
            }
            return Marshal.ReadIntPtr(linkedBuf);
        }
        finally { Marshal.FreeHGlobal(linkedBuf); }
    }

    private static Exception Win32(string call, int err) =>
        new InvalidOperationException($"{call} failed (Win32 {err})");

    public async ValueTask DisposeAsync()
    {
        _cts?.Cancel();
        if (_loop is not null)
        {
            try { await _loop; } catch { /* ignore */ }
        }
        _cts?.Dispose();
    }

    // Same access model as the control pipe: the standard-user player must be able to
    // connect, so grant Authenticated Users read/write while SYSTEM/Admins keep full control.
    private static PipeSecurity BuildPipeAcl()
    {
        var acl = new PipeSecurity();
        acl.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.AuthenticatedUserSid, null),
            PipeAccessRights.ReadWrite, AccessControlType.Allow));
        acl.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
            PipeAccessRights.FullControl, AccessControlType.Allow));
        acl.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
            PipeAccessRights.FullControl, AccessControlType.Allow));
        return acl;
    }

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed class ElevateRequest
    {
        public string? Path { get; set; }
        public string? Args { get; set; }
    }

    private sealed class ElevateReply
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }
    }

    // --- Win32 interop --------------------------------------------------------
    private const int LOGON32_LOGON_INTERACTIVE = 2;
    private const int LOGON32_PROVIDER_DEFAULT = 0;
    private const uint TOKEN_ALL_ACCESS = 0xF01FF;
    private const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    private const int TokenElevationType = 18;      // TOKEN_INFORMATION_CLASS
    private const int TokenLinkedToken = 19;
    private const int TokenElevationTypeLimited = 3; // UAC-filtered admin token

    [StructLayout(LayoutKind.Sequential)]
    private struct SECURITY_ATTRIBUTES
    {
        public int nLength;
        public IntPtr lpSecurityDescriptor;
        public int bInheritHandle;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string? lpReserved;
        public string? lpDesktop;
        public string? lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool LogonUser(string user, string domain, string password,
        int logonType, int logonProvider, out IntPtr token);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool DuplicateTokenEx(IntPtr existingToken, uint desiredAccess,
        ref SECURITY_ATTRIBUTES tokenAttributes, int SecurityIdentification, int TokenType,
        out IntPtr newToken);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool SetTokenInformation(IntPtr token, int TokenSessionId,
        ref uint value, int length);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool GetTokenInformation(IntPtr token, int infoClass, IntPtr info,
        int infoLength, out int returnLength);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool CreateEnvironmentBlock(out IntPtr env, IntPtr token, bool bInherit);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool DestroyEnvironmentBlock(IntPtr env);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessAsUser(IntPtr token, string? appName, string cmdLine,
        IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags,
        IntPtr environment, string? currentDir, ref STARTUPINFO si, out PROCESS_INFORMATION pi);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);
}
