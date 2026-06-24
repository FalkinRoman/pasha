using System.IO.Pipes;
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
                using var server = new NamedPipeServerStream(
                    IpcJson.PipeName,
                    PipeDirection.InOut,
                    maxNumberOfServerInstances: 1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

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

        // Send the current view right away so the shell can render without waiting a tick.
        if (_latestView is not null)
            await writer.WriteLineAsync(_latestView.AsMemory(), linked.Token);

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
