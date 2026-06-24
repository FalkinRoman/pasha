using System.Text.Json;
using System.Text.Json.Serialization;
using StopkekAgent.Core;

namespace StopkekAgent.Ipc;

/// <summary>Commands the shell may send back to the agent.</summary>
public sealed class ShellCommand
{
    [JsonPropertyName("cmd")] public string Cmd { get; set; } = "";

    /// <summary>Plaintext PIN for AdminExit (validated by the agent against its hash). Local pipe only.</summary>
    [JsonPropertyName("pin")] public string? Pin { get; set; }

    public const string EndSession = "end-session";
    public const string Heartbeat = "heartbeat";
    public const string Hello = "hello";
    public const string AdminExit = "admin-exit";
}

public static class IpcJson
{
    public const string PipeName = "stopkek-kiosk-agent";

    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    public static string SerializeView(KioskView v) => JsonSerializer.Serialize(v, Options);
}
