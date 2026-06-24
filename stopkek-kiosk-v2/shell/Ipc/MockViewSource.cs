using System.IO;
using System.Windows.Threading;

namespace StopkekShell.Ipc;

/// <summary>
/// Drives the UI through a realistic cycle with no agent/server, for visual testing:
///   LOCKED (8s) -> ACTIVE counting down -> WARNING (notice) -> GRACE -> LOCKED.
/// Launch the shell with --mock.
/// </summary>
public sealed class MockViewSource : IViewSource
{
    public event Action<KioskView>? ViewUpdated;

    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromMilliseconds(500) };
    private long _rev;
    private DateTime _phaseStart;
    private int _phase; // 0 locked, 1 active, 2 grace
    private long _activeMs = 70_000; // start active demo with 70s so warnings show fast

    // Optional: if %TEMP%\stopkek-mock-qr.txt exists (a real data-URL from the server's
    // qrcode output), the mock shows it on the lock screen to prove the QR pipeline.
    private static readonly string? MockQr = ReadMockQr();
    private static string? ReadMockQr()
    {
        try
        {
            var p = Path.Combine(Path.GetTempPath(), "stopkek-mock-qr.txt");
            return File.Exists(p) ? File.ReadAllText(p).Trim() : null;
        }
        catch { return null; }
    }

    public void Start()
    {
        _phase = 0;
        _phaseStart = DateTime.UtcNow;
        _timer.Tick += Tick;
        _timer.Start();
        Tick(this, EventArgs.Empty);
    }

    private void Tick(object? s, EventArgs e)
    {
        var elapsed = (DateTime.UtcNow - _phaseStart).TotalMilliseconds;
        switch (_phase)
        {
            case 0: // locked
                ViewUpdated?.Invoke(new KioskView
                {
                    Mode = KioskMode.Locked, Online = true, SeatNumber = 5,
                    QrPayload = "{\"v\":2,\"type\":\"stopkek-unlock\",\"seat\":5,\"challengeId\":\"demo\"}",
                    QrImageBase64 = MockQr,
                    QrRefreshSec = 120, Revision = ++_rev,
                });
                if (elapsed > 8000) { _phase = 1; _phaseStart = DateTime.UtcNow; }
                break;

            case 1: // active, counting down
                var remaining = _activeMs - (long)elapsed;
                if (remaining <= 0) { _phase = 2; _phaseStart = DateTime.UtcNow; break; }
                ViewUpdated?.Invoke(new KioskView
                {
                    Mode = KioskMode.Active, Online = true, SeatNumber = 5,
                    UserName = "Demo Player", ZoneName = "VIP", BalanceRub = 350,
                    RemainingMs = remaining,
                    Notice = remaining <= 60_000 ? "Осталось меньше минуты — продлите в приложении" : null,
                    Revision = ++_rev,
                });
                break;

            case 2: // grace
                var graceLeft = 20_000 - (long)elapsed;
                if (graceLeft <= 0) { _phase = 0; _phaseStart = DateTime.UtcNow; break; }
                ViewUpdated?.Invoke(new KioskView
                {
                    Mode = KioskMode.Grace, Online = true, SeatNumber = 5,
                    UserName = "Demo Player", ZoneName = "VIP",
                    GraceRemainingMs = graceLeft,
                    Notice = "Время вышло — продлите в приложении",
                    Revision = ++_rev,
                });
                break;
        }
    }

    public void SendCommand(string cmd)
    {
        // In mock, "end-session" jumps straight to locked.
        if (cmd == "end-session") { _phase = 0; _phaseStart = DateTime.UtcNow; }
    }

    public void Dispose() => _timer.Stop();
}
