import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';

type PcCodeEntry = {
  bookingId: string;
  seatNumber: number;
  exp: number;
};

type QrChallenge = {
  seatNumber: number;
  exp: number;
};

const CODE_TTL_MS = 5 * 60_000;
const CHALLENGE_TTL_MS = 2 * 60_000;
// A queued toast is offered on the seat's next few state polls (agent dedups by id).
const TOAST_TTL_MS = 30_000;

@Injectable()
export class KioskService {
  private readonly codes = new Map<string, PcCodeEntry>();
  private readonly challenges = new Map<string, QrChallenge>();
  private readonly toasts = new Map<
    number,
    { text: string; id: string; exp: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly config: ConfigService
  ) {}

  async issuePcCode(userId: string, bookingId: string) {
    await this.bookings.syncSeatStatesForKiosk();
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
        status: { in: ['paid', 'active'] },
        endAt: { gt: new Date() },
      },
      include: {
        seats: true,
        user: { select: { name: true, phone: true } },
      },
    });
    if (!booking) throw new NotFoundException('Активная бронь не найдена');
    const seatNumber = booking.seats[0]?.seatNumber;
    if (!seatNumber) throw new BadRequestException('В брони нет места');

    const code = String(randomInt(100_000, 1_000_000));
    this.codes.set(code, {
      bookingId,
      seatNumber,
      exp: Date.now() + CODE_TTL_MS,
    });

    const apiBase =
      this.config.get<string>('PUBLIC_API_URL', '').replace(/\/api\/?$/, '') ||
      '';

    return {
      code,
      seatNumber,
      expiresInSec: Math.floor(CODE_TTL_MS / 1000),
      qrPayload: JSON.stringify({
        v: 1,
        seat: seatNumber,
        code,
        api: apiBase ? `${apiBase}/api` : undefined,
      }),
      userName: booking.user.name || 'Гость',
    };
  }

  async unlock(seatNumber: number, code: string) {
    await this.bookings.syncSeatStatesForKiosk();
    const entry = this.codes.get(code);
    if (!entry || entry.exp < Date.now() || entry.seatNumber !== seatNumber) {
      throw new BadRequestException('Неверный или просроченный код');
    }
    this.codes.delete(code);
    return this.unlockBooking(entry.bookingId, seatNumber);
  }

  async confirmQr(userId: string, bookingId: string, challengeId: string) {
    await this.bookings.syncSeatStatesForKiosk();
    const ch = this.challenges.get(challengeId);
    if (!ch || ch.exp < Date.now()) {
      throw new BadRequestException('QR устарел — обновите код на мониторе');
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
        status: { in: ['paid', 'active'] },
        endAt: { gt: new Date() },
      },
      include: { seats: true },
    });
    if (!booking) throw new NotFoundException('Активная бронь не найдена');
    const seatNumber = booking.seats[0]?.seatNumber;
    if (!seatNumber || seatNumber !== ch.seatNumber) {
      throw new BadRequestException('Этот QR для другого компьютера');
    }

    this.challenges.delete(challengeId);
    await this.unlockBooking(bookingId, seatNumber);
    return { ok: true, seatNumber };
  }

  private async unlockBooking(bookingId: string, seatNumber: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking || booking.status === 'completed' || booking.status === 'cancelled') {
      throw new BadRequestException('Сеанс недоступен');
    }
    const seatMatch = booking.seats.some((s) => s.seatNumber === seatNumber);
    if (!seatMatch) throw new BadRequestException('Бронь не для этого ПК');

    if (booking.status === 'paid' && new Date() >= booking.startAt) {
      await this.bookings.activateScheduledForKiosk(booking.id);
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { pcUnlockedAt: new Date() },
    });

    await this.bookings.notifyPcUnlocked(bookingId, seatNumber);

    return this.getSeatState(seatNumber);
  }

  private createQrChallenge(seatNumber: number) {
    const now = Date.now();
    for (const [id, c] of this.challenges) {
      if (c.seatNumber === seatNumber && c.exp > now) return id;
      if (c.exp <= now) this.challenges.delete(id);
    }
    const challengeId = randomUUID();
    this.challenges.set(challengeId, {
      seatNumber,
      exp: now + CHALLENGE_TTL_MS,
    });
    return challengeId;
  }

  private buildQrPayload(seatNumber: number, challengeId: string) {
    return JSON.stringify({
      v: 2,
      type: 'stopkek-unlock',
      seat: seatNumber,
      challengeId,
    });
  }

  // Render the QR once per payload. A payload only changes when its challenge
  // rotates (~2 min per seat), so caching avoids re-encoding on every 8s poll.
  private readonly qrCache = new Map<string, string>();

  private async renderQrImage(payload: string): Promise<string> {
    const cached = this.qrCache.get(payload);
    if (cached) return cached;
    const image = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
      color: { dark: '#0A0A0A', light: '#FFFFFF' },
    });
    if (this.qrCache.size > 200) this.qrCache.clear(); // bound memory across seats
    this.qrCache.set(payload, image);
    return image;
  }

  /**
   * Queue a one-shot toast to slide in on a kiosk PC. Delivered inside the
   * seat's next state polls until the TTL lapses; the agent shows it once
   * (dedup by id). Used by the admin "test notification to PC" button.
   */
  enqueueToast(seatNumber: number, text: string) {
    const id = randomUUID();
    this.toasts.set(seatNumber, { text, id, exp: Date.now() + TOAST_TTL_MS });
    return { id };
  }

  private adminToast(seatNumber: number): { text: string; id: string } | undefined {
    const t = this.toasts.get(seatNumber);
    if (!t) return undefined;
    if (t.exp < Date.now()) {
      this.toasts.delete(seatNumber);
      return undefined;
    }
    return { text: t.text, id: t.id };
  }

  // Time-running-out warning as a toast. A stable id per (booking, threshold)
  // makes the agent show each threshold exactly once as time crosses it.
  private warnToast(
    bookingId: string,
    session: { gameRunning: boolean; displayRemainingMs: number }
  ): { text: string; id: string } | undefined {
    if (!session.gameRunning) return undefined;
    const ms = session.displayRemainingMs;
    const mins =
      ms <= 0 ? 0 : ms <= 60_000 ? 1 : ms <= 5 * 60_000 ? 5 : ms <= 15 * 60_000 ? 15 : 0;
    if (!mins) return undefined;
    return {
      text: `Осталось меньше ${mins} мин — продлите в приложении`,
      id: `warn-${bookingId}-${mins}`,
    };
  }

  async getSeatState(seatNumber: number) {
    await this.bookings.syncSeatStatesForKiosk();
    const seat = await this.prisma.seat.findFirst({ where: { number: seatNumber } });
    if (!seat) throw new NotFoundException('Место не найдено');

    const now = new Date();
    const row = await this.prisma.booking.findFirst({
      where: {
        status: { in: ['paid', 'active'] },
        pcUnlockedAt: { not: null },
        seats: { some: { seatNumber } },
        endAt: { gt: now },
      },
      include: {
        user: { select: { name: true, phone: true } },
        seats: { include: { seat: { include: { zone: true } } } },
      },
      orderBy: { pcUnlockedAt: 'desc' },
    });

    if (!row) {
      const challengeId = this.createQrChallenge(seatNumber);
      const qrPayload = this.buildQrPayload(seatNumber, challengeId);
      return {
        state: 'locked' as const,
        seatNumber,
        seatStatus: seat.status,
        qrPayload,
        qrImage: await this.renderQrImage(qrPayload),
        qrRefreshSec: Math.floor(CHALLENGE_TTL_MS / 1000),
        toast: this.adminToast(seatNumber),
      };
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: row.userId },
    });
    const session = {
      ...this.bookings.formatBooking(row),
      userName: row.user.name || 'Гость',
      phoneMask: `···${row.user.phone.slice(-4)}`,
      balanceRub: Math.round((wallet?.balance ?? 0) / 100),
    };
    const expired = session.displayRemainingMs <= 0 && session.gameRunning;

    if (expired || (row.status === 'active' && session.displayRemainingMs <= 0)) {
      return {
        state: 'expired' as const,
        seatNumber,
        session,
        toast: this.adminToast(seatNumber),
      };
    }

    const warn15 =
      session.gameRunning && session.displayRemainingMs <= 15 * 60_000;

    return {
      state: 'active' as const,
      seatNumber,
      session,
      notice: warn15 ? 'Осталось меньше 15 минут — продлите в приложении' : undefined,
      toast: this.adminToast(seatNumber) ?? this.warnToast(row.id, session),
    };
  }

  async endSeatSession(seatNumber: number) {
    await this.bookings.syncSeatStatesForKiosk();
    const now = new Date();
    const row = await this.prisma.booking.findFirst({
      where: {
        status: { in: ['paid', 'active'] },
        pcUnlockedAt: { not: null },
        seats: { some: { seatNumber } },
        endAt: { gt: now },
      },
      orderBy: { pcUnlockedAt: 'desc' },
    });
    if (!row) {
      throw new NotFoundException('Нет активного сеанса на этом ПК');
    }
    if (row.status === 'active') {
      await this.bookings.endSession(row.userId, row.id);
    } else {
      await this.prisma.booking.update({
        where: { id: row.id },
        data: { pcUnlockedAt: null },
      });
    }
    return this.getSeatState(seatNumber);
  }
}
