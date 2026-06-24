using System.Text.Json.Serialization;

namespace StopkekShell;

public enum KioskMode { Locked, Active, Grace, Maintenance }

/// <summary>Mirror of the agent's KioskView (camelCase, enum-as-string over IPC).
/// The shell renders this and makes no policy decisions of its own.</summary>
public sealed class KioskView
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public KioskMode Mode { get; set; }
    public bool Online { get; set; }
    public int SeatNumber { get; set; }

    public string? QrPayload { get; set; }
    public int QrRefreshSec { get; set; }
    public string? QrImageBase64 { get; set; }

    public string? UserName { get; set; }
    public string? ZoneName { get; set; }
    public int BalanceRub { get; set; }

    public long RemainingMs { get; set; }
    public long GraceRemainingMs { get; set; }

    public string? Notice { get; set; }
    public string? Message { get; set; }
    public bool AdminExitEnabled { get; set; }
    public long Revision { get; set; }
}
