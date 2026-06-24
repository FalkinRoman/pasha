using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;

namespace StopkekShell.Ipc;

/// <summary>
/// Named-pipe client to the agent. Reads newline-delimited KioskView JSON and raises
/// ViewUpdated; sends ShellCommand lines back. Auto-reconnects: if the pipe drops
/// (agent restart), it keeps retrying so the shell heals itself. While disconnected
/// the shell stays on its last view (fail-secure: usually the lock).
/// </summary>
public sealed class AgentIpcClient : IViewSource
{
    public const string PipeName = "stopkek-kiosk-agent";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public event Action<KioskView>? ViewUpdated;

    private readonly CancellationTokenSource _cts = new();
    private NamedPipeClientStream? _pipe;
    private StreamWriter? _writer;
    private readonly object _writeGate = new();
    private Task? _loop;

    public void Start() => _loop = Task.Run(() => ConnectLoopAsync(_cts.Token));

    private async Task ConnectLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var pipe = new NamedPipeClientStream(
                    ".", PipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
                await pipe.ConnectAsync(3000, ct);
                _pipe = pipe;

                var reader = new StreamReader(pipe, Encoding.UTF8);
                lock (_writeGate)
                    _writer = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true };

                SendCommand("hello");

                while (!ct.IsCancellationRequested && pipe.IsConnected)
                {
                    var line = await reader.ReadLineAsync(ct);
                    if (line is null) break;
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    try
                    {
                        var view = JsonSerializer.Deserialize<KioskView>(line, JsonOpts);
                        if (view is not null) ViewUpdated?.Invoke(view);
                    }
                    catch (JsonException) { /* ignore malformed line */ }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception) { /* connect failed / pipe broke — retry */ }
            finally
            {
                lock (_writeGate) { _writer = null; }
                _pipe = null;
            }

            try { await Task.Delay(1000, ct); } catch { break; }
        }
    }

    public void SendCommand(string cmd)
    {
        lock (_writeGate)
        {
            try { _writer?.WriteLine(JsonSerializer.Serialize(new { cmd })); }
            catch { /* will reconnect */ }
        }
    }

    public void SendAdminExit(string pin)
    {
        lock (_writeGate)
        {
            try { _writer?.WriteLine(JsonSerializer.Serialize(new { cmd = "admin-exit", pin })); }
            catch { /* will reconnect */ }
        }
    }

    public void Dispose()
    {
        _cts.Cancel();
        try { _loop?.Wait(1000); } catch { }
        _cts.Dispose();
    }
}
