using System.Text.Json;
using System.Text.Json.Serialization;

namespace StopkekAgent.Config;

/// <summary>
/// Per-machine configuration. Lives in config.json next to the executable so an
/// operator can set seatNumber / kioskKey per PC without rebuilding.
/// </summary>
public sealed class KioskConfig
{
    public string ApiUrl { get; set; } = "https://stopkek.site/api";
    public int SeatNumber { get; set; } = 1;
    public string KioskKey { get; set; } = "";

    /// <summary>How often to poll /kiosk/state (seconds).</summary>
    public int PollIntervalSec { get; set; } = 8;

    /// <summary>
    /// After paid time runs out, how long the player may keep playing before the
    /// PC is re-locked ("finish your match" grace). 0 = lock immediately.
    /// </summary>
    public int GraceSeconds { get; set; } = 300;

    /// <summary>Minutes-before-end at which to surface a non-blocking warning.</summary>
    public int[] WarnMinutes { get; set; } = { 15, 5, 1 };

    /// <summary>Lock the PC the moment the agent starts, before the first poll succeeds (fail-secure).</summary>
    public bool LockOnStartup { get; set; } = true;

    /// <summary>Absolute path to the shell UI executable. Empty = watchdog disabled.</summary>
    public string ShellPath { get; set; } = "";

    /// <summary>Relaunch the shell if it dies and lock the workstation meanwhile.</summary>
    public bool WatchdogEnabled { get; set; }

    /// <summary>
    /// SHA-256 hex of the admin "panic exit" PIN. When set, the lock screen shows a faint
    /// close button → keypad; entering this PIN drops the agent into maintenance (overlay off,
    /// watchdog off) until reboot. Empty = feature disabled (no admin exit button).
    /// Never store the plaintext PIN; never commit a real hash to the repo (short PINs are
    /// brute-forceable). Set it per-PC in this PC's config.json.
    /// </summary>
    public string AdminExitPinHash { get; set; } = "";

    public bool AdminExitEnabled => !string.IsNullOrWhiteSpace(AdminExitPinHash);

    /// <summary>
    /// Hidden local admin account used to launch programs "as administrator" for the
    /// standard-user player without a password prompt (see ElevationServer). Created by the
    /// installer; the password stays here only because config.json is ACL-locked to
    /// SYSTEM/Admins (the player cannot read it). Empty = elevation feature disabled.
    /// </summary>
    public string ElevateUser { get; set; } = "";
    public string ElevatePassword { get; set; } = "";

    public bool ElevateEnabled =>
        !string.IsNullOrWhiteSpace(ElevateUser) && !string.IsNullOrWhiteSpace(ElevatePassword);

    public TimeSpan PollInterval => TimeSpan.FromSeconds(Math.Clamp(PollIntervalSec, 2, 60));
    public TimeSpan Grace => TimeSpan.FromSeconds(Math.Max(0, GraceSeconds));

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static KioskConfig Load(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"config.json not found at {path}");
        var json = File.ReadAllText(path);
        var cfg = JsonSerializer.Deserialize<KioskConfig>(json, JsonOpts)
                  ?? throw new InvalidDataException("config.json is empty or invalid");
        cfg.Validate();
        return cfg;
    }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ApiUrl))
            throw new InvalidDataException("config.apiUrl is required");
        if (SeatNumber < 1)
            throw new InvalidDataException("config.seatNumber must be >= 1");
        if (string.IsNullOrWhiteSpace(KioskKey) || KioskKey.StartsWith("CHANGE-ME"))
            throw new InvalidDataException("config.kioskKey must be set to the real KIOSK_API_KEY");
    }
}
