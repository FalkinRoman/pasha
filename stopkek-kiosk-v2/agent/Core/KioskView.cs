namespace StopkekAgent.Core;

public enum KioskMode
{
    /// <summary>PC blocked: fullscreen QR lock, hotkeys trapped.</summary>
    Locked,
    /// <summary>Paid session running: overlay hidden, only the timer widget.</summary>
    Active,
    /// <summary>Paid time ran out, "finish your match" grace before re-lock.</summary>
    Grace,
    /// <summary>Admin entered the panic-exit PIN: overlay off, nothing relocks, until reboot.</summary>
    Maintenance,
}

/// <summary>
/// Immutable snapshot the agent computes each tick and pushes to the shell over IPC.
/// The shell is a pure renderer of this — it makes no policy decisions of its own.
/// </summary>
public sealed record KioskView
{
    public required KioskMode Mode { get; init; }
    public required bool Online { get; init; }
    public required int SeatNumber { get; init; }

    // Locked
    public string? QrPayload { get; init; }
    public int QrRefreshSec { get; init; }
    /// <summary>Base64 PNG data URL of the QR, rendered by the server.</summary>
    public string? QrImageBase64 { get; init; }

    // Active / Grace
    public string? UserName { get; init; }
    public string? ZoneName { get; init; }
    public int BalanceRub { get; init; }

    /// <summary>Locally-tracked ms left (monotonic; immune to wall-clock changes). 0 in Grace.</summary>
    public long RemainingMs { get; init; }

    /// <summary>Ms left in the grace window (only meaningful in Grace mode).</summary>
    public long GraceRemainingMs { get; init; }

    /// <summary>Server-provided non-blocking notice (e.g. "осталось меньше 15 минут").</summary>
    public string? Notice { get; init; }

    /// <summary>One-shot toast text to slide in on the right. Null when there is nothing new.</summary>
    public string? ToastText { get; init; }

    /// <summary>Id of the current toast; the shell shows a toast once whenever this changes.</summary>
    public string? ToastId { get; init; }

    /// <summary>Human-readable status line for offline / setup problems.</summary>
    public string? Message { get; init; }

    /// <summary>Whether to show the admin panic-exit affordance on the lock screen.</summary>
    public bool AdminExitEnabled { get; init; }

    public long Revision { get; init; }
}
