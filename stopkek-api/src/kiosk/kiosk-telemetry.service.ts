import { Injectable } from '@nestjs/common';

export type KioskEvent = {
  type: string; // heartbeat | tamper | shell_killed | offline | ...
  detail?: string;
  at: string; // ISO
};

type SeatTelemetry = {
  seatNumber: number;
  lastSeenAt: string;
  hostname?: string;
  ip?: string;
  events: KioskEvent[];
};

const ONLINE_WINDOW_MS = 30_000; // seen within 30s = online
const MAX_EVENTS = 20;

/**
 * In-memory kiosk telemetry: which PCs are online, and recent tamper/diagnostic
 * events. Deliberately not persisted (no DB migration) — it is live operational
 * state, fine to lose on API restart. The admin reads it for a "club PCs" view.
 */
@Injectable()
export class KioskTelemetryService {
  private readonly seats = new Map<number, SeatTelemetry>();

  heartbeat(seatNumber: number, info: { hostname?: string; ip?: string } = {}) {
    const t = this.ensure(seatNumber);
    t.lastSeenAt = new Date().toISOString();
    if (info.hostname) t.hostname = info.hostname;
    if (info.ip) t.ip = info.ip;
  }

  event(seatNumber: number, type: string, detail?: string) {
    const t = this.ensure(seatNumber);
    t.lastSeenAt = new Date().toISOString();
    t.events.unshift({ type, detail, at: t.lastSeenAt });
    if (t.events.length > MAX_EVENTS) t.events.length = MAX_EVENTS;
  }

  list() {
    const now = Date.now();
    return [...this.seats.values()]
      .sort((a, b) => a.seatNumber - b.seatNumber)
      .map((t) => ({
        ...t,
        online: now - new Date(t.lastSeenAt).getTime() < ONLINE_WINDOW_MS,
      }));
  }

  private ensure(seatNumber: number): SeatTelemetry {
    let t = this.seats.get(seatNumber);
    if (!t) {
      t = { seatNumber, lastSeenAt: new Date(0).toISOString(), events: [] };
      this.seats.set(seatNumber, t);
    }
    return t;
  }
}
