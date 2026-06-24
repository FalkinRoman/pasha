using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using StopkekAgent.Config;

namespace StopkekAgent.Api;

public sealed record PollResult(KioskStateDto? State, bool Reachable, string? Error);

/// <summary>
/// Thin HTTP client for the kiosk-facing endpoints. Authenticates with the shared
/// X-Kiosk-Key header (per-machine creds are a Phase-5 server change).
/// Never throws to the caller: returns a PollResult so the state machine can apply
/// fail-secure / keep-alive policy instead of crashing the loop.
/// </summary>
public sealed class KioskApiClient
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly KioskConfig _cfg;
    private readonly ILogger<KioskApiClient> _log;

    public KioskApiClient(HttpClient http, KioskConfig cfg, ILogger<KioskApiClient> log)
    {
        _cfg = cfg;
        _log = log;
        _http = http;
        _http.BaseAddress = new Uri(cfg.ApiUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(10);
        _http.DefaultRequestHeaders.Remove("X-Kiosk-Key");
        _http.DefaultRequestHeaders.Add("X-Kiosk-Key", cfg.KioskKey);
    }

    public async Task<PollResult> GetStateAsync(CancellationToken ct)
    {
        try
        {
            using var resp = await _http.GetAsync(
                $"kiosk/state?seatNumber={_cfg.SeatNumber}", ct);

            if (resp.StatusCode == HttpStatusCode.Unauthorized)
                return new PollResult(null, true, "Неверный kioskKey (401)");

            if (!resp.IsSuccessStatusCode)
                return new PollResult(null, true, $"HTTP {(int)resp.StatusCode}");

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            var dto = await JsonSerializer.DeserializeAsync<KioskStateDto>(stream, JsonOpts, ct);
            if (dto is null)
                return new PollResult(null, true, "Пустой ответ state");

            return new PollResult(dto, true, null);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // Network down / timeout — not reachable. State machine decides policy.
            _log.LogWarning("state poll failed: {Msg}", ex.Message);
            return new PollResult(null, false, ex.Message);
        }
        catch (JsonException ex)
        {
            return new PollResult(null, true, "Битый JSON: " + ex.Message);
        }
    }

    /// <summary>Report a telemetry event (tamper, shell relaunch, etc.). Best-effort.</summary>
    public async Task ReportEventAsync(string type, string? detail, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(new
            {
                seatNumber = _cfg.SeatNumber,
                type,
                detail,
                hostname = Environment.MachineName,
            });
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync("kiosk/telemetry", content, ct);
        }
        catch (Exception ex)
        {
            _log.LogDebug("telemetry report failed: {Msg}", ex.Message);
        }
    }

    /// <summary>User-initiated end-session from the kiosk widget. Best-effort.</summary>
    public async Task<bool> EndSessionAsync(CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(new { seatNumber = _cfg.SeatNumber });
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync("kiosk/end-session", content, ct);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _log.LogWarning("end-session failed: {Msg}", ex.Message);
            return false;
        }
    }
}
