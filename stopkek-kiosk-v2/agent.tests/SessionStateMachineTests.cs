using Microsoft.Extensions.Logging.Abstractions;
using StopkekAgent.Api;
using StopkekAgent.Config;
using StopkekAgent.Core;

namespace StopkekAgent.Tests;

public class SessionStateMachineTests
{
    private static KioskConfig Cfg(int graceSec = 300) => new()
    {
        ApiUrl = "http://x/api",
        SeatNumber = 1,
        KioskKey = "k",
        GraceSeconds = graceSec,
    };

    private static SessionStateMachine Machine(KioskConfig? cfg = null) =>
        new(cfg ?? Cfg(), NullLogger.Instance);

    private static PollResult Active(long remainingMs, string? notice = null) =>
        new(new KioskStateDto
        {
            State = "active",
            SeatNumber = 1,
            Notice = notice,
            Session = new SessionDto { DisplayRemainingMs = remainingMs, UserName = "Ivan", ZoneName = "VIP" },
        }, true, null);

    private static PollResult Expired() =>
        new(new KioskStateDto { State = "expired", SeatNumber = 1, Session = new SessionDto() }, true, null);

    private static PollResult Locked() =>
        new(new KioskStateDto { State = "locked", SeatNumber = 1, QrPayload = "{qr}", QrRefreshSec = 120 }, true, null);

    private static PollResult Offline() => new(null, false, "timeout");

    [Test]
    public void Unlocks_immediately_on_active()
    {
        var m = Machine();
        var v = m.Apply(Active(3_600_000), 0);
        Assert.Equal(KioskMode.Active, v.Mode);
        Assert.Equal("Ivan", v.UserName);
        Assert.True(v.RemainingMs > 0);
    }

    [Test]
    public void Single_locked_read_does_not_drop_active_session()
    {
        var m = Machine();
        m.Apply(Active(3_600_000), 0);

        var v1 = m.Apply(Locked(), 1000);   // glitch
        Assert.Equal(KioskMode.Active, v1.Mode); // held by hysteresis

        var v2 = m.Apply(Locked(), 2000);   // confirmed
        Assert.Equal(KioskMode.Locked, v2.Mode);
    }

    [Test]
    public void Monotonic_countdown_decreases_with_elapsed_time()
    {
        var m = Machine();
        m.Apply(Active(600_000), 0);              // 10 min, anchored at t=0
        var v = m.Apply(Offline(), 60_000);       // 60s later, offline
        Assert.Equal(KioskMode.Active, v.Mode);
        Assert.False(v.Online);
        Assert.InRange(v.RemainingMs, 539_000, 540_000); // ~9 min left
    }

    [Test]
    public void Active_offline_slides_into_grace_then_locks()
    {
        var cfg = Cfg(graceSec: 60);
        var m = Machine(cfg);
        m.Apply(Active(10_000), 0);               // 10s of paid time, offline ahead

        var g = m.Apply(Offline(), 11_000);       // paid time exhausted
        Assert.Equal(KioskMode.Grace, g.Mode);
        Assert.True(g.GraceRemainingMs > 0);

        var stillGrace = m.Apply(Offline(), 40_000);
        Assert.Equal(KioskMode.Grace, stillGrace.Mode);

        var locked = m.Apply(Offline(), 11_000 + 61_000); // grace (60s) elapsed
        Assert.Equal(KioskMode.Locked, locked.Mode);
    }

    [Test]
    public void Expired_enters_grace_and_locks_after_window()
    {
        var cfg = Cfg(graceSec: 120);
        var m = Machine(cfg);
        m.Apply(Active(5_000), 0);

        var g = m.Apply(Expired(), 1000);
        Assert.Equal(KioskMode.Grace, g.Mode);

        var locked = m.Apply(Expired(), 1000 + 121_000);
        Assert.Equal(KioskMode.Locked, locked.Mode);
    }

    [Test]
    public void Grace_zero_locks_immediately()
    {
        var m = Machine(Cfg(graceSec: 0));
        m.Apply(Active(5_000), 0);
        var v = m.Apply(Expired(), 1000);
        Assert.Equal(KioskMode.Locked, v.Mode);
    }

    [Test]
    public void Locked_stays_locked_when_offline()
    {
        var m = Machine();
        m.Apply(Locked(), 0);
        m.Apply(Locked(), 1000);
        var v = m.Apply(Offline(), 2000);
        Assert.Equal(KioskMode.Locked, v.Mode);
        Assert.False(v.Online);
        Assert.Equal("{qr}", v.QrPayload); // reuse last QR
    }

    [Test]
    public void Notice_is_passed_through_on_active()
    {
        var m = Machine();
        var v = m.Apply(Active(600_000, notice: "warn15"), 0);
        Assert.Equal("warn15", v.Notice);
    }
}
