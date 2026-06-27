using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using StopkekAgent.Core;

namespace StopkekAgent.Ipc;

/// <summary>
/// Duplex named-pipe server. The agent is the server; the shell connects as a
/// client. Protocol = newline-delimited JSON. The agent broadcasts the latest
/// KioskView (and re-sends it on every new connection so the shell never starts blind);
/// the shell sends ShellCommand lines back.
///
/// Single-client by design: one PC = one shell. A new connection replaces the old.
/// </summary>
public sealed class IpcServer : IAsyncDisposable
{
    private readonly ILogger _log;
    private readonly Func<ShellCommand, Task> _onCommand;
    private readonly Channel<string> _outbound =
        Channel.CreateBounded<string>(new BoundedChannelOptions(64)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
        });

    private string? _latestView;
    private DateTime _lastShellSeen = DateTime.MinValue;
    private CancellationTokenSource? _cts;
    private Task? _loop;

    // The agent runs as SYSTEM; the shell runs as the limited player in an interactive
    // session. A pipe created by SYSTEM with the default DACL grants only SYSTEM/Admins,
    // so a standard user's ConnectAsync fails with access-denied — the player-session
    // shell could never attach (retries forever, no overlay ever renders). Grant
    // authenticated users connect/read/write, keeping SYSTEM and Admins in full control.
    private static readonly PipeSecurity PipeAcl = BuildPipeAcl();

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

    public IpcServer(ILogger log, Func<ShellCommand, Task> onCommand)
    {
        _log = log;
        _onCommand = onCommand;
    }

    /// <summary>When the shell last connected/heartbeated — used by the watchdog.</summary>
    public DateTime LastShellSeen => _lastShellSeen;
    public bool ShellConnected { get; private set; }

    public void Start(CancellationToken appStopping)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(appStopping);
        _loop = Task.Run(() => AcceptLoopAsync(_cts.Token));
    }

    /// <summary>Push the newest view. Cached so a freshly-connected shell gets it immediately.</summary>
    public void Publish(KioskView view)
    {
        _latestView = IpcJson.SerializeView(view);
        _outbound.Writer.TryWrite(_latestView);
    }

    private async Task AcceptLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var server = NamedPipeServerStreamAcl.Create(
                    IpcJson.PipeName,
                    PipeDirection.InOut,
                    maxNumberOfServerInstances: 1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous,
                    inBufferSize: 4096,
                    outBufferSize: 4096,
                    PipeAcl);

                await server.WaitForConnectionAsync(ct);
                ShellConnected = true;
                _lastShellSeen = DateTime.UtcNow;
                _log.LogInformation("shell connected");

                await ServeClientAsync(server, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning("ipc accept error: {Msg}", ex.Message);
                await Task.Delay(500, ct).ContinueWith(_ => { }, TaskScheduler.Default);
            }
            finally
            {
                ShellConnected = false;
            }
        }
    }

    private async Task ServeClientAsync(NamedPipeServerStream pipe, CancellationToken ct)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var reader = new StreamReader(pipe, Encoding.UTF8);
        var writer = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true };

        // Re-send the current view so a freshly-connected shell renders without waiting a
        // tick. Crucially we enqueue it through the write pump (which runs concurrently with
        // the read pump) instead of writing it here, before reads start: a direct blocking
        // write would dead-lock against the shell, which also writes its "hello" before it
        // begins reading — both sides stuck writing, neither reading, until the pipe broke.
        if (_latestView is not null)
            _outbound.Writer.TryWrite(_latestView);

        var writeTask = WritePumpAsync(writer, pipe, linked.Token);
        var readTask = ReadPumpAsync(reader, pipe, linked.Token);

        await Task.WhenAny(writeTask, readTask);
        linked.Cancel();
        await Task.WhenAll(
            writeTask.ContinueWith(_ => { }, TaskScheduler.Default),
            readTask.ContinueWith(_ => { }, TaskScheduler.Default));
        _log.LogInformation("shell disconnected");
    }

    private async Task WritePumpAsync(StreamWriter writer, PipeStream pipe, CancellationToken ct)
    {
        try
        {
            await foreach (var msg in _outbound.Reader.ReadAllAsync(ct))
            {
                if (!pipe.IsConnected) break;
                await writer.WriteLineAsync(msg.AsMemory(), ct);
            }
        }
        catch (Exception) when (ct.IsCancellationRequested) { }
        catch (IOException) { /* pipe broken — accept loop will recycle */ }
    }

    private async Task ReadPumpAsync(StreamReader reader, PipeStream pipe, CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested && pipe.IsConnected)
            {
                var line = await reader.ReadLineAsync(ct);
                if (line is null) break;
                _lastShellSeen = DateTime.UtcNow;
                if (string.IsNullOrWhiteSpace(line)) continue;

                ShellCommand? cmd;
                try { cmd = JsonSerializer.Deserialize<ShellCommand>(line, IpcJson.Options); }
                catch (JsonException) { _log.LogWarning("bad command json: {Line}", line); continue; }

                if (cmd is null || string.IsNullOrEmpty(cmd.Cmd)) continue;
                if (cmd.Cmd == ShellCommand.Heartbeat) continue;

                await _onCommand(cmd);
            }
        }
        catch (Exception) when (ct.IsCancellationRequested) { }
        catch (IOException) { }
    }

    public async ValueTask DisposeAsync()
    {
        _cts?.Cancel();
        if (_loop is not null)
        {
            try { await _loop; } catch { /* ignore */ }
        }
        _cts?.Dispose();
    }
}
