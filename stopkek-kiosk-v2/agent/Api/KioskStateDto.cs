using System.Text.Json.Serialization;

namespace StopkekAgent.Api;

/// <summary>
/// Raw shape of GET /api/kiosk/state. Mirrors KioskService.getSeatState on the server:
///  - state = "locked"   => qrPayload + qrRefreshSec
///  - state = "active"   => session + optional notice
///  - state = "expired"  => session
/// </summary>
public sealed class KioskStateDto
{
    [JsonPropertyName("state")] public string State { get; set; } = "locked";
    [JsonPropertyName("seatNumber")] public int SeatNumber { get; set; }
    [JsonPropertyName("seatStatus")] public string? SeatStatus { get; set; }

    // locked
    [JsonPropertyName("qrPayload")] public string? QrPayload { get; set; }
    [JsonPropertyName("qrRefreshSec")] public int? QrRefreshSec { get; set; }
    /// <summary>Server-rendered QR as a base64 PNG data URL (Phase-5 server addition).</summary>
    [JsonPropertyName("qrImage")] public string? QrImage { get; set; }

    // active / expired
    [JsonPropertyName("session")] public SessionDto? Session { get; set; }
    [JsonPropertyName("notice")] public string? Notice { get; set; }

    /// <summary>One-shot toast to slide in on the right (any state). Shown once per Id.</summary>
    [JsonPropertyName("toast")] public ToastDto? Toast { get; set; }
}

public sealed class ToastDto
{
    [JsonPropertyName("text")] public string Text { get; set; } = "";
    [JsonPropertyName("id")] public string Id { get; set; } = "";
}

public sealed class SessionDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("zoneName")] public string ZoneName { get; set; } = "";
    [JsonPropertyName("userName")] public string UserName { get; set; } = "Гость";
    [JsonPropertyName("phoneMask")] public string? PhoneMask { get; set; }
    [JsonPropertyName("balanceRub")] public int BalanceRub { get; set; }
    [JsonPropertyName("seatNumbers")] public int[] SeatNumbers { get; set; } = Array.Empty<int>();

    [JsonPropertyName("startAt")] public string StartAt { get; set; } = "";
    [JsonPropertyName("endAt")] public string EndAt { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("sessionPhase")] public string SessionPhase { get; set; } = "";

    [JsonPropertyName("gameRunning")] public bool GameRunning { get; set; }
    [JsonPropertyName("timerMode")] public string TimerMode { get; set; } = "";
    [JsonPropertyName("timerLabel")] public string TimerLabel { get; set; } = "";

    /// <summary>Server-computed milliseconds left on the visible timer (source of truth).</summary>
    [JsonPropertyName("displayRemainingMs")] public long DisplayRemainingMs { get; set; }
    [JsonPropertyName("untilEndMs")] public long UntilEndMs { get; set; }
}
