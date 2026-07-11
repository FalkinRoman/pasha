import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SeatStatus, SessionPhase } from '@prisma/client';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { LockerLogService } from '../locker/locker-log.service';
import { LocksService } from '../locks/locks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOOR_EARLY_MIN,
  NO_SHOW_GRACE_MIN,
  BOOKING_MAX_DAYS_AHEAD,
} from './session.constants';

const PENDING_MS_DEFAULT = 15 * 60 * 1000;

@Injectable()
export class BookingsService {
  private readonly pendingMs: number;

  private readonly uploadRoot = join(process.cwd(), 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly locks: LocksService,
    private readonly lockerLog: LockerLogService,
    private readonly notifications: NotificationsService,
    config: ConfigService
  ) {
    this.pendingMs =
      Number(config.get('BOOKING_PENDING_TTL_SEC', 900)) * 1000 || PENDING_MS_DEFAULT;
  }

  /** Cron: paid, не зашёл в клуб */
  async processNoShow() {
    const now = new Date();
    const list = await this.prisma.booking.findMany({
      where: {
        status: 'paid',
        sessionPhase: { in: ['awaiting_arrival', 'arrival'] },
      },
      include: { seats: true },
    });
    for (const b of list) {
      const deadline = new Date(
        b.startAt.getTime() + NO_SHOW_GRACE_MIN * 60_000
      );
      if (now >= deadline) {
        await this.releaseBooking(b.id, 'no_show');
      }
    }
  }

  private doorWindowStart(startAt: Date) {
    return new Date(startAt.getTime() - DOOR_EARLY_MIN * 60_000);
  }

  private inDoorWindow(startAt: Date, endAt: Date, now = new Date()) {
    const t = now.getTime();
    return t >= this.doorWindowStart(startAt).getTime() && t < endAt.getTime();
  }


  /** Есть ли бронь, пересекающаяся с выбранным слотом */
  async assertSeatAvailableForSlot(
    seatId: string,
    startAt: Date,
    endAt: Date,
    excludeBookingId?: string
  ) {
    const conflicts = await this.prisma.booking.findMany({
      where: {
        status: { in: ['pending_payment', 'paid', 'active'] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        seats: { some: { seatId } },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { id: true },
    });
    if (conflicts.length > 0) {
      throw new BadRequestException('Место занято на выбранное время');
    }
  }

  /** Визуальный статус места с учётом времени (не только флага в БД) */
  resolveDisplayStatus(
    dbStatus: SeatStatus,
    bookings: { status: BookingStatus; startAt: Date; endAt: Date }[],
    now = new Date()
  ): SeatStatus {
    if (dbStatus === 'repair') return 'repair';

    if (bookings.some((b) => b.status === 'active' && now < b.endAt)) {
      return 'occupied';
    }

    if (
      bookings.some(
        (b) =>
          (b.status === 'paid' || b.status === 'pending_payment') &&
          this.inDoorWindow(b.startAt, b.endAt, now)
      )
    ) {
      return 'reserved';
    }

    return 'free';
  }

  private async recomputeSeatDbStatus(seatId: string) {
    const seat = await this.prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat || seat.status === 'repair') return;

    const now = new Date();
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ['pending_payment', 'paid', 'active'] },
        endAt: { gt: now },
        seats: { some: { seatId } },
      },
      select: { status: true, startAt: true, endAt: true },
    });

    const next = this.resolveDisplayStatus(seat.status, bookings, now);
    if (seat.status !== next) {
      await this.prisma.seat.update({
        where: { id: seatId },
        data: { status: next },
      });
    }
  }

  private pickDisplayBooking(
    bookings: { status: BookingStatus; startAt: Date; endAt: Date }[],
    displayStatus: SeatStatus,
    now = new Date()
  ) {
    if (displayStatus === 'occupied') {
      return bookings.find((b) => b.status === 'active' && now < b.endAt);
    }
    if (displayStatus === 'reserved') {
      return bookings.find(
        (b) =>
          (b.status === 'paid' || b.status === 'pending_payment') &&
          this.inDoorWindow(b.startAt, b.endAt, now)
      );
    }
    return undefined;
  }

  async getFloorMapSeatStates(): Promise<
    Map<string, { status: SeatStatus; bookedFrom?: string; bookedUntil?: string }>
  > {
    const now = new Date();
    const [seats, bookings] = await Promise.all([
      this.prisma.seat.findMany(),
      this.prisma.booking.findMany({
        where: {
          status: { in: ['pending_payment', 'paid', 'active'] },
          endAt: { gt: now },
        },
        select: {
          status: true,
          startAt: true,
          endAt: true,
          seats: { select: { seatId: true } },
        },
      }),
    ]);

    const bySeat = new Map<string, { status: BookingStatus; startAt: Date; endAt: Date }[]>();
    for (const b of bookings) {
      for (const { seatId } of b.seats) {
        const list = bySeat.get(seatId) ?? [];
        list.push({ status: b.status, startAt: b.startAt, endAt: b.endAt });
        bySeat.set(seatId, list);
      }
    }

    const result = new Map<
      string,
      { status: SeatStatus; bookedFrom?: string; bookedUntil?: string }
    >();
    for (const seat of seats) {
      const seatBookings = bySeat.get(seat.id) ?? [];
      const status = this.resolveDisplayStatus(seat.status, seatBookings, now);
      const booking = this.pickDisplayBooking(seatBookings, status, now);
      result.set(seat.id, {
        status,
        ...(booking
          ? {
              bookedFrom: booking.startAt.toISOString(),
              bookedUntil: booking.endAt.toISOString(),
            }
          : {}),
      });
    }
    return result;
  }

  /** @deprecated используй getFloorMapSeatStates */
  async getFloorMapSeatStatuses(): Promise<Map<string, SeatStatus>> {
    const states = await this.getFloorMapSeatStates();
    return new Map([...states.entries()].map(([id, s]) => [id, s.status]));
  }

  private assertStartWithinBookingWindow(startAt: Date) {
    const now = new Date();
    const maxStart = new Date(now.getTime() + BOOKING_MAX_DAYS_AHEAD * 86_400_000);
    if (startAt.getTime() > maxStart.getTime()) {
      throw new BadRequestException(`Бронь доступна максимум на ${BOOKING_MAX_DAYS_AHEAD} дней вперёд`);
    }
  }

  private normalizePhase(
    status: BookingStatus,
    sessionPhase: SessionPhase,
    startAt: Date,
    endAt: Date,
    now = new Date()
  ): SessionPhase {
    if (status === 'completed' || status === 'cancelled') return sessionPhase;
    if (
      ['acceptance', 'cell_pending', 'issue', 'checkout'].includes(sessionPhase)
    ) {
      if (status === 'active') return 'playing';
      return this.inDoorWindow(startAt, endAt, now) ? 'arrival' : 'awaiting_arrival';
    }
    if (status === 'paid') {
      if (!this.inDoorWindow(startAt, endAt, now)) return 'awaiting_arrival';
      if (sessionPhase === 'awaiting_arrival') return 'arrival';
      return sessionPhase === 'playing' ? 'arrival' : sessionPhase;
    }
    if (status === 'active') {
      if (now.getTime() < startAt.getTime()) {
        return this.inDoorWindow(startAt, endAt, now) ? 'arrival' : 'awaiting_arrival';
      }
      return 'playing';
    }
    return sessionPhase;
  }

  /** По расписанию: с startAt включаем игровой таймер */
  private async activateScheduledIfDue(bookingId: string) {
    const now = new Date();
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking || booking.status !== 'paid' || now < booking.startAt) return null;
    const seatId = booking.seats[0]?.seatId;
    if (!seatId) return null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.seat.update({
        where: { id: seatId },
        data: { status: 'occupied' },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'active',
          sessionPhase: 'playing',
          startedAt: booking.startAt,
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    });

    return updated;
  }

  async syncSeatStates() {
    const now = new Date();
    const pendingBefore = new Date(now.getTime() - this.pendingMs);

    const stalePending = await this.prisma.booking.findMany({
      where: { status: 'pending_payment', createdAt: { lt: pendingBefore } },
      include: { seats: true },
    });
    for (const b of stalePending) {
      await this.releaseBooking(b.id, 'cancelled');
    }

    const expired = await this.prisma.booking.findMany({
      where: {
        status: 'active',
        endAt: { lte: now },
      },
      include: { seats: true },
    });
    for (const b of expired) {
      await this.releaseBooking(b.id, 'completed');
    }

    const dueStart = await this.prisma.booking.findMany({
      where: {
        status: 'paid',
        startAt: { lte: now },
        endAt: { gt: now },
      },
    });
    for (const b of dueStart) {
      await this.activateScheduledIfDue(b.id);
    }

    const seats = await this.prisma.seat.findMany({
      where: { status: { not: 'repair' } },
      select: { id: true },
    });
    for (const { id } of seats) {
      await this.recomputeSeatDbStatus(id);
    }
  }

  async syncSeatStatesForKiosk() {
    await this.syncSeatStates();
  }

  async activateScheduledForKiosk(bookingId: string) {
    await this.activateScheduledIfDue(bookingId);
  }

  async getActive(userId: string) {
    await this.syncSeatStates();
    const now = new Date();
    const b = await this.prisma.booking.findFirst({
      where: {
        userId,
        status: { in: ['paid', 'active'] },
        OR: [
          { endAt: { gt: now } },
          {
            status: 'paid',
            startedAt: null,
            startAt: {
              gt: new Date(now.getTime() - NO_SHOW_GRACE_MIN * 60_000),
            },
          },
        ],
      },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!b) return null;

    let current = b;
    if (b.status === 'paid' && now >= b.startAt) {
      const activated = await this.activateScheduledIfDue(b.id);
      if (activated) current = activated;
    }

    const phase = this.normalizePhase(
      current.status,
      current.sessionPhase,
      current.startAt,
      current.endAt
    );
    if (phase !== current.sessionPhase) {
      const updated = await this.prisma.booking.update({
        where: { id: current.id },
        data: { sessionPhase: phase },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
      return this.formatBooking(updated);
    }
    return this.formatBooking(current);
  }

  async getHistory(userId: string) {
    await this.syncSeatStates();
    const list = await this.prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['completed', 'cancelled', 'active', 'paid', 'no_show'] },
      },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return list.map((b) => this.formatBooking(b));
  }

  async getById(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });
    if (!booking) throw new NotFoundException('Бронь не найдена');
    return this.formatBooking(booking);
  }

  // Sub-hour / fractional durations are a test-only affordance (16-min bookings so
  // we don't wait an hour to see notifications / expiry). They are refused unless the
  // server runs with ALLOW_TEST_BOOKINGS=1 AND the caller explicitly asks (isTest).
  private assertDurationAllowed(durationHours: number, isTest?: boolean) {
    const isShort = durationHours < 1 || !Number.isInteger(durationHours);
    if (!isShort) return;
    const gateOpen = process.env.ALLOW_TEST_BOOKINGS === '1';
    if (isTest && gateOpen) return;
    throw new BadRequestException('Минимальная длительность брони — 1 час');
  }

  async quote(
    seatId: string,
    durationHours: number,
    startAtIso?: string,
    timeWindowId?: string,
    isTest?: boolean
  ) {
    this.assertDurationAllowed(durationHours, isTest);
    const seat = await this.prisma.seat.findUnique({
      where: { id: seatId },
      include: { zone: true },
    });
    if (!seat) throw new NotFoundException('Место не найдено');
    const startAt = startAtIso ? new Date(startAtIso) : new Date();
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Некорректное время начала');
    }
    const endAt = new Date(startAt.getTime() + Math.round(durationHours * 60) * 60_000);
    this.assertStartWithinBookingWindow(startAt);
    await this.assertSeatAvailableForSlot(seatId, startAt, endAt);
    return this.pricing.quoteForSeat(
      seat.zoneId,
      seat.zone.clubId,
      seat.zone.pricePerHour,
      durationHours,
      startAt,
      timeWindowId
    );
  }

  async create(
    userId: string,
    seatId: string,
    durationHours: number,
    startAtIso?: string,
    timeWindowId?: string,
    isTest?: boolean
  ) {
    this.assertDurationAllowed(durationHours, isTest);
    await this.syncSeatStates();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const seat = await this.prisma.seat.findUnique({
      where: { id: seatId },
      include: { zone: true },
    });
    if (!seat) throw new NotFoundException('Место не найдено');
    if (seat.status === 'repair') {
      throw new BadRequestException('Место на обслуживании');
    }

    const startAt = startAtIso ? new Date(startAtIso) : new Date();
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Некорректное время начала');
    }
    const now = new Date();
    if (startAt.getTime() < now.getTime() - 30_000) {
      throw new BadRequestException('Время начала не может быть в прошлом');
    }
    const durationMinutes = Math.round(durationHours * 60);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    this.assertStartWithinBookingWindow(startAt);
    await this.assertSeatAvailableForSlot(seatId, startAt, endAt);

    const current = await this.getActive(userId);
    if (current) throw new BadRequestException('Уже есть активный сеанс или бронь');

    const price = await this.pricing.quoteForSeat(
      seat.zoneId,
      seat.zone.clubId,
      seat.zone.pricePerHour,
      durationHours,
      startAt,
      timeWindowId
    );

    const booking = await this.prisma.booking.create({
      data: {
        userId,
        status: 'pending_payment',
        sessionPhase: 'awaiting_arrival',
        startAt,
        endAt,
        durationMinutes,
        basePrice: price.basePriceKopecks,
        discountAmount: price.discountAmountKopecks,
        totalPrice: price.totalPriceKopecks,
        seats: {
          create: { seatId, seatNumber: seat.number },
        },
      },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });

    await this.recomputeSeatDbStatus(seatId);

    return this.formatBooking(booking);
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });
    if (!booking) return { ok: true };

    if (booking.status === 'pending_payment') {
      await this.releaseBooking(bookingId, 'cancelled');
      return { ok: true };
    }

    if (booking.status === 'paid') {
      await this.releaseBooking(bookingId, 'cancelled');
      return { ok: true, refundRub: 0 };
    }

    throw new BadRequestException('Активный сеанс нельзя отменить — только завершить');
  }

  /** @deprecated use cancelBooking */
  async cancelPending(userId: string, bookingId: string) {
    return this.cancelBooking(userId, bookingId);
  }

  async payFromWallet(userId: string, bookingId: string) {
    await this.syncSeatStates();

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });
    if (!booking) throw new NotFoundException('Бронь не найдена');
    if (booking.status !== 'pending_payment') {
      throw new BadRequestException('Бронь уже оплачена или отменена');
    }

    const seat = booking.seats[0]?.seat;
    if (!seat) throw new BadRequestException('Нет места в брони');

    await this.assertSeatAvailableForSlot(
      seat.id,
      booking.startAt,
      booking.endAt,
      bookingId
    );

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < booking.totalPrice) {
      throw new BadRequestException('Недостаточно средств на балансе');
    }

    const now = new Date();
    const sessionDue = now.getTime() >= booking.startAt.getTime();
    const inWindow = this.inDoorWindow(booking.startAt, booking.endAt, now);

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { externalId: bookingId },
      });
      if (!existing) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: booking.totalPrice } },
        });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'booking_payment',
            amount: -booking.totalPrice,
            description: `Место #${booking.seats[0].seatNumber}`,
            externalId: bookingId,
          },
        });
      }

      if (sessionDue) {
        await tx.seat.update({
          where: { id: seat.id },
          data: { status: 'occupied' },
        });
        return tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'active',
            sessionPhase: 'playing',
            startedAt: booking.startAt,
            endAt: booking.endAt,
          },
          include: { seats: { include: { seat: { include: { zone: true } } } } },
        });
      }

      const phase: SessionPhase = inWindow ? 'arrival' : 'awaiting_arrival';
      const paid = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'paid',
          sessionPhase: phase,
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
      return paid;
    });

    for (const s of updated.seats) {
      await this.recomputeSeatDbStatus(s.seatId);
    }

    return this.formatBooking(updated);
  }

  /** Push «приятной игры» — только после разблокировки своего зарезервированного ПК. */
  async notifyPcUnlocked(bookingId: string, seatNumber: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking) return;
    const reserved = booking.seats[0]?.seatNumber;
    if (!reserved || reserved !== seatNumber) return;
    void this.notifications.notifySessionStarted(
      booking.userId,
      bookingId,
      seatNumber
    );
  }

  private async getOngoingBooking(userId: string, bookingId: string) {
    const now = new Date();
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
        status: { in: ['paid', 'active'] },
        OR: [
          { endAt: { gt: now } },
          {
            status: 'paid',
            startedAt: null,
            startAt: {
              gt: new Date(
                now.getTime() - NO_SHOW_GRACE_MIN * 60_000
              ),
            },
          },
        ],
      },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });
    if (!booking) throw new NotFoundException('Сеанс не найден');
    return booking;
  }

  async openMainDoor(userId: string, bookingId: string) {
    const booking = await this.getOngoingBooking(userId, bookingId);

    const recent = await this.prisma.lockerLog.findFirst({
      where: {
        bookingId,
        type: 'lock_open_main',
        createdAt: { gte: new Date(Date.now() - 30_000) },
      },
    });
    if (recent) {
      throw new BadRequestException('Подождите 30 сек перед повторным открытием');
    }

    if (!this.inDoorWindow(booking.startAt, booking.endAt)) {
      throw new BadRequestException(
        `Доступ в клуб откроется за ${DOOR_EARLY_MIN} минут до начала`
      );
    }

    const club = await this.prisma.club.findFirst();
    const seat = booking.seats[0]?.seat;
    const seatNumber = booking.seats[0]?.seatNumber ?? seat?.number ?? 0;

    const lockId = club?.mainDoorLockId?.trim();
    if (!lockId) {
      throw new BadRequestException(
        'Главная дверь не настроена в админке (Настройки → Замки)'
      );
    }

    const lockResult = await this.locks.open({
      lockId,
      userId,
      bookingId,
      provider: club?.lockProvider ?? 'mock',
      httpBaseUrl: club?.lockHttpBaseUrl,
      httpToken: club?.lockHttpToken,
      mqttTopic: club?.lockMqttTopic,
    });
    if (!lockResult.ok) {
      throw new BadRequestException(lockResult.error ?? 'Не удалось открыть замок');
    }

    let updated = booking;
    if (booking.status === 'paid') {
      const activated = await this.activateScheduledIfDue(bookingId);
      if (activated) updated = activated;
    }

    const phase = this.normalizePhase(
      updated.status,
      updated.sessionPhase,
      updated.startAt,
      updated.endAt
    );
    if (phase !== updated.sessionPhase) {
      updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { sessionPhase: phase },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    }

    void this.lockerLog.write({
      bookingId,
      userId,
      seatId: seat?.id,
      seatNumber,
      cellLock: lockId,
      type: 'lock_open_main',
      payload: { lockId, ok: lockResult.ok },
    });

    return {
      ...this.formatBooking(updated),
      lockCommandSent: true,
      lockType: 'main',
    };
  }

  async quoteExtend(userId: string, bookingId: string) {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.status !== 'active' || booking.sessionPhase !== 'playing') {
      throw new BadRequestException('Продление только во время игры');
    }
    const seat = booking.seats[0]?.seat;
    if (!seat) throw new BadRequestException('Нет места');

    const extendStart = booking.endAt;
    const minuteSteps = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    const fullQuote = await this.pricing.quoteForSeat(
      seat.zoneId,
      seat.zone.clubId,
      seat.zone.pricePerHour,
      1,
      extendStart
    );

    const minutePresets = minuteSteps.map((minutes) => {
      const q = this.pricing.quoteExtensionMinutes(seat.zone.pricePerHour, minutes);
      return {
        minutes,
        basePriceRub: Math.round(q.basePriceKopecks / 100),
        totalPriceRub: Math.round(q.totalPriceKopecks / 100),
        discountRub: 0,
      };
    });

    const hourPresets = await Promise.all(
      fullQuote.presets.map(async (preset) => {
        const q = await this.pricing.quoteForSeat(
          seat.zoneId,
          seat.zone.clubId,
          seat.zone.pricePerHour,
          preset.hours,
          extendStart
        );
        const packageDiscountKopecks = this.pricing.packageDiscountKopecks(q);
        return {
          hours: preset.hours,
          basePriceRub: Math.round(q.basePriceKopecks / 100),
          totalPriceRub: Math.round(q.totalPriceRub),
          discountRub: Math.round(packageDiscountKopecks / 100),
          discountPercent: preset.discountPercent,
          label: preset.label,
        };
      })
    );

    const packagePresets = await Promise.all(
      fullQuote.windowPresets.map(async (def) => {
        const timeWindowId = def.packageId.startsWith('tw-')
          ? def.packageId.slice(3)
          : def.packageId;
        const pkgStart = new Date(extendStart);
        pkgStart.setHours(def.startHour, 0, 0, 0);
        pkgStart.setSeconds(0, 0);
        if (pkgStart < extendStart) pkgStart.setDate(pkgStart.getDate() + 1);
        const q = await this.pricing.quoteForSeat(
          seat.zoneId,
          seat.zone.clubId,
          seat.zone.pricePerHour,
          def.hours,
          pkgStart,
          timeWindowId
        );
        return {
          packageId: def.packageId,
          label: def.label,
          window: def.window,
          hours: def.hours,
          basePriceRub: Math.round(q.basePriceKopecks / 100),
          totalPriceRub: Math.round(q.totalPriceRub),
          discountRub: Math.round(q.discountAmountKopecks / 100),
          discountPercent: def.discountPercent,
        };
      })
    );

    return { minutePresets, hourPresets, packagePresets, pricePerHour: seat.zone.pricePerHour };
  }

  async extendSession(
    userId: string,
    bookingId: string,
    dto: { hours?: number; minutes?: number; timeWindowId?: string }
  ) {
    const { hours, minutes, timeWindowId } = dto;
    let addMinutes: number;
    let label: string;

    if (minutes != null) {
      if (minutes % 5 !== 0 || minutes < 5 || minutes > 480) {
        throw new BadRequestException('Продление поминутно: от 5 до 480 мин, шаг 5');
      }
      addMinutes = minutes;
      label = `${minutes} мин`;
    } else if (hours != null) {
      if (hours < 1 || hours > 12) {
        throw new BadRequestException('Продление от 1 до 12 часов');
      }
      addMinutes = hours * 60;
      label = `${hours} ч`;
    } else {
      throw new BadRequestException('Укажите hours или minutes');
    }

    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.status !== 'active' || booking.sessionPhase !== 'playing') {
      throw new BadRequestException('Продление только во время игры');
    }
    const seat = booking.seats[0]?.seat;
    if (!seat) throw new BadRequestException('Нет места');
    const extendStart = booking.endAt;
    const durationHours = addMinutes / 60;
    const price =
      minutes != null
        ? this.pricing.quoteExtensionMinutes(seat.zone.pricePerHour, minutes)
        : await this.pricing.quoteForSeat(
            seat.zoneId,
            seat.zone.clubId,
            seat.zone.pricePerHour,
            durationHours,
            extendStart,
            timeWindowId
          );
    const addKopecks = price.totalPriceKopecks;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < addKopecks) {
      throw new BadRequestException('Недостаточно средств на балансе');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: addKopecks } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'extension',
          amount: -addKopecks,
          description: `Продление +${label}, место #${booking.seats[0].seatNumber}`,
          externalId: `${bookingId}-ext-${Date.now()}`,
        },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          endAt: new Date(booking.endAt.getTime() + addMinutes * 60_000),
          durationMinutes: booking.durationMinutes + addMinutes,
          basePrice: booking.basePrice + price.basePriceKopecks,
          discountAmount: booking.discountAmount + price.discountAmountKopecks,
          totalPrice: booking.totalPrice + addKopecks,
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    });

    return this.formatBooking(updated);
  }

  async endSession(userId: string, bookingId: string) {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.status !== 'active') {
      throw new BadRequestException('Сеанс ещё не начался');
    }

    const now = new Date();

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { endAt: now },
    });

    await this.releaseBooking(bookingId, 'completed');
    void this.notifications.notifySessionEnded(userId, bookingId);
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      ok: true,
      refundRub: 0,
      balanceRub: Math.round((wallet?.balance ?? 0) / 100),
    };
  }

  private async releaseBooking(bookingId: string, status: BookingStatus) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking || booking.status === 'completed' || booking.status === 'cancelled') {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status },
      });
    });

    for (const s of booking.seats) {
      await this.recomputeSeatDbStatus(s.seatId);
    }
  }

  formatBooking(booking: {
    id: string;
    status: BookingStatus;
    sessionPhase: SessionPhase;
    startAt: Date;
    endAt: Date;
    startedAt: Date | null;
    durationMinutes: number;
    totalPrice: number;
    basePrice?: number;
    discountAmount?: number;
    seats: { seatNumber: number; seat: { zone: { name: string } } }[];
  }) {
    const now = new Date();
    const zoneName = booking.seats[0]?.seat.zone.name ?? '';
    const phase = this.normalizePhase(
      booking.status,
      booking.sessionPhase,
      booking.startAt,
      booking.endAt,
      now
    );
    const gameRunning =
      booking.status === 'active' &&
      now.getTime() >= booking.startAt.getTime() &&
      booking.startedAt != null &&
      now.getTime() >= booking.startedAt.getTime();
    const doorOpen = this.inDoorWindow(booking.startAt, booking.endAt, now);
    const untilStartMs = Math.max(0, booking.startAt.getTime() - now.getTime());
    const untilEndMs = Math.max(0, booking.endAt.getTime() - now.getTime());
    const doorOpensMs = Math.max(
      0,
      this.doorWindowStart(booking.startAt).getTime() - now.getTime()
    );

    let timerMode: string;
    let displayRemainingMs: number;
    let timerLabel: string;

    if (gameRunning) {
      timerMode = 'playing';
      displayRemainingMs = untilEndMs;
      timerLabel = 'осталось';
    } else if (
      booking.status === 'paid' ||
      (booking.status === 'active' && untilStartMs > 0)
    ) {
      if (doorOpensMs > 0) {
        timerMode = 'until_door';
        displayRemainingMs = doorOpensMs;
        timerLabel = 'до входа в клуб';
      } else if (untilStartMs > 0) {
        timerMode = 'until_start';
        displayRemainingMs = untilStartMs;
        timerLabel = 'до начала';
      } else {
        timerMode = 'until_start';
        displayRemainingMs = Math.max(untilEndMs, 0);
        timerLabel = 'до старта';
      }
    } else {
      timerMode = 'until_end';
      displayRemainingMs = untilEndMs;
      timerLabel = 'осталось';
    }

    const canAccessDoors =
      doorOpen && ['awaiting_arrival', 'arrival', 'playing'].includes(phase);

    return {
      id: booking.id,
      seatNumbers: booking.seats.map((s) => s.seatNumber),
      zoneName,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      startedAt: booking.startedAt?.toISOString() ?? null,
      durationMinutes: booking.durationMinutes,
      totalPrice: Math.round(booking.totalPrice / 100),
      basePriceRub: Math.round((booking.basePrice ?? booking.totalPrice) / 100),
      discountRub: Math.round((booking.discountAmount ?? 0) / 100),
      status: booking.status,
      sessionPhase: phase,
      gameRunning,
      timerMode,
      timerLabel,
      displayRemainingMs,
      doorWindowOpen: doorOpen,
      untilStartMs,
      untilEndMs,
      canOpenMainDoor: canAccessDoors,
    };
  }

}
