import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string } & Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoUrl = 'https://exp.host/--/api/v2/push/send';
  private readonly expoReceiptsUrl =
    'https://exp.host/--/api/v2/push/getReceipts';

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, token: string, platform: string) {
    return this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform, updatedAt: new Date() },
    });
  }

  async getPrefs(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) return null;
    return {
      session: u.notifySession,
      remind: u.notifyRemind15,
      promo: u.notifyPromo,
    };
  }

  async updatePrefs(
    userId: string,
    prefs: { session?: boolean; remind?: boolean; promo?: boolean }
  ) {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(prefs.session !== undefined ? { notifySession: prefs.session } : {}),
        ...(prefs.remind !== undefined ? { notifyRemind15: prefs.remind } : {}),
        ...(prefs.promo !== undefined ? { notifyPromo: prefs.promo } : {}),
      },
    });
    return {
      session: u.notifySession,
      remind: u.notifyRemind15,
      promo: u.notifyPromo,
    };
  }

  private async sendExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
    if (!messages.length) return [];
    try {
      const res = await fetch(this.expoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}: ${text.slice(0, 500)}`);
        return [];
      }
      const tickets: ExpoTicket[] = JSON.parse(text)?.data ?? [];
      const errors = tickets.filter((t) => t.status === 'error');
      if (errors.length) {
        this.logger.warn(`Expo push tickets with errors: ${JSON.stringify(errors)}`);
      }
      return tickets;
    } catch (e) {
      this.logger.warn(`Expo push failed: ${e}`);
      return [];
    }
  }

  /** Poll Expo push receipts — this is where real delivery failures (e.g. an
   *  expired FCM credential → DeviceNotRegistered / MessageRateExceeded) surface. */
  private async getReceipts(
    ids: string[]
  ): Promise<Record<string, { status: string; message?: string; details?: unknown }>> {
    if (!ids.length) return {};
    try {
      const res = await fetch(this.expoReceiptsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ids }),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`Expo receipts HTTP ${res.status}: ${text.slice(0, 500)}`);
        return {};
      }
      return JSON.parse(text)?.data ?? {};
    } catch (e) {
      this.logger.warn(`Expo receipts failed: ${e}`);
      return {};
    }
  }

  /**
   * Admin "test push" — send straight to a user's devices, bypassing pref flags
   * and the booking-based dedup log, and return a diagnostic (token count, Expo
   * tickets, delivery receipts) so the reason a push does/doesn't arrive is visible
   * in the admin UI and API logs.
   */
  async sendTestToUser(userId: string, title: string, body: string) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (!tokens.length) {
      this.logger.warn(`test push: user ${userId} has no registered push tokens`);
      return { ok: false, reason: 'no_tokens' as const, tokenCount: 0, tickets: [], receipts: {} };
    }

    const tickets = await this.sendExpo(
      tokens.map((t) => ({ to: t.token, title, body, data: { type: 'test' } }))
    );

    const ids = tickets.filter((t) => t.id).map((t) => t.id as string);
    let receipts: Record<string, { status: string; message?: string; details?: unknown }> = {};
    if (ids.length) {
      // Expo needs a moment to produce receipts; a short wait is enough for a manual test.
      await new Promise((r) => setTimeout(r, 1500));
      receipts = await this.getReceipts(ids);
    }

    const okTickets = tickets.filter((t) => t.status === 'ok').length;
    this.logger.log(
      `test push to ${userId}: tokens=${tokens.length} okTickets=${okTickets} ` +
        `tickets=${JSON.stringify(tickets)} receipts=${JSON.stringify(receipts)}`
    );
    return {
      ok: okTickets > 0,
      reason: okTickets > 0 ? ('sent' as const) : ('rejected' as const),
      tokenCount: tokens.length,
      tickets,
      receipts,
    };
  }

  private async pushToUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    bookingId?: string,
    checkPref?: keyof Pick<
      { session: boolean; remind: boolean; promo: boolean },
      'session' | 'remind' | 'promo'
    >
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    if (checkPref === 'session' && !user.notifySession) return;
    if (checkPref === 'remind' && !user.notifyRemind15) return;
    if (checkPref === 'promo' && !user.notifyPromo) return;

    if (bookingId) {
      const exists = await this.prisma.notificationLog.findUnique({
        where: { bookingId_type: { bookingId, type } },
      });
      if (exists) return;
    }

    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (!tokens.length) return;

    await this.sendExpo(
      tokens.map((t) => ({
        to: t.token,
        title,
        body,
        data: bookingId ? { bookingId } : undefined,
      }))
    );

    await this.prisma.notificationLog.create({
      data: { userId, bookingId: bookingId ?? null, type },
    });
  }

  async notifySessionStarted(userId: string, bookingId: string, seatNum: number) {
    await this.pushToUser(
      userId,
      'session_start',
      'Сеанс начался',
      `Место #${seatNum} — приятной игры`,
      bookingId,
      'session'
    );
  }

  /** Cron: напоминание за ~15 мин до конца */
  async processRemind15() {
    const now = Date.now();
    const from = new Date(now + 14 * 60_000);
    const to = new Date(now + 16 * 60_000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: 'active',
        sessionPhase: 'playing',
        endAt: { gte: from, lte: to },
      },
      include: { seats: true, user: true },
    });

    for (const b of bookings) {
      const seatNum = b.seats[0]?.seatNumber ?? 0;
      const minLeft = Math.round((b.endAt.getTime() - now) / 60_000);
      await this.pushToUser(
        b.userId,
        'session_remind_15',
        'Скоро конец сеанса',
        `Место #${seatNum}: осталось ~${minLeft} мин`,
        b.id,
        'remind'
      );
    }
  }

  async notifySessionEnded(userId: string, bookingId: string) {
    await this.pushToUser(
      userId,
      'session_end',
      'Сеанс завершён',
      'Спасибо за визит в стопкек',
      bookingId,
      'session'
    );
  }
}
