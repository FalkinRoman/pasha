import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoUrl = 'https://exp.host/--/api/v2/push/send';

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

  private async sendExpo(messages: ExpoMessage[]) {
    if (!messages.length) return;
    try {
      const res = await fetch(this.expoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}`);
      }
    } catch (e) {
      this.logger.warn(`Expo push failed: ${e}`);
    }
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
