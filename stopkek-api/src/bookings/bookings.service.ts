import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionPhase } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { LockerLogService } from '../locker/locker-log.service';
import { ensureSeatCellLock } from '../locks/lock-ids';
import { LocksService } from '../locks/locks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAcceptanceDto } from './dto/acceptance.dto';
import {
  DOOR_EARLY_MIN,
  NO_SHOW_GRACE_MIN,
  REFUND_MIN_REMAINING_MIN,
  WALK_IN_START_MIN,
  ACCEPTANCE_BUFFER_MIN,
} from './session.constants';

const PENDING_MS_DEFAULT = 15 * 60 * 1000;
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

@Injectable()
export class BookingsService {
  private readonly pendingMs: number;

  private readonly uploadRoot = join(process.cwd(), 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: LocksService,
    private readonly lockerLog: LockerLogService,
    private readonly notifications: NotificationsService,
    config: ConfigService
  ) {
    this.pendingMs =
      Number(config.get('BOOKING_PENDING_TTL_SEC', 900)) * 1000 || PENDING_MS_DEFAULT;
    mkdirSync(join(this.uploadRoot, 'acceptance'), { recursive: true });
    mkdirSync(join(this.uploadRoot, 'checkout'), { recursive: true });
  }

  private saveBookingPhoto(
    folder: 'acceptance' | 'checkout',
    bookingId: string,
    file: Express.Multer.File
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Загрузите фото');
    }
    const ext = extname(file.originalname || '').toLowerCase();
    if (!PHOTO_EXT.has(ext)) {
      throw new BadRequestException('Формат: JPG, PNG или WebP');
    }
    const rel = join(folder, `${bookingId}${ext}`);
    writeFileSync(join(this.uploadRoot, rel), file.buffer);
    return rel;
  }

  /** Cron: paid, не зашёл в клуб */
  async processNoShow() {
    const now = new Date();
    const list = await this.prisma.booking.findMany({
      where: {
        status: 'paid',
        sessionPhase: { in: ['awaiting_arrival', 'arrival', 'cell_pending'] },
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

  private isWalkIn(startAt: Date, now = new Date()) {
    return startAt.getTime() <= now.getTime() + WALK_IN_START_MIN * 60_000;
  }

  private inDoorWindow(startAt: Date, endAt: Date, now = new Date()) {
    const t = now.getTime();
    return t >= this.doorWindowStart(startAt).getTime() && t < endAt.getTime();
  }

  /** Обновляет фазу по времени (лениво) */
  private resolvePhase(
    status: BookingStatus,
    sessionPhase: SessionPhase,
    startAt: Date,
    endAt: Date,
    now = new Date()
  ): SessionPhase {
    if (status === 'completed' || status === 'cancelled') return sessionPhase;
    if (sessionPhase === 'issue' || sessionPhase === 'checkout') return sessionPhase;

    if (status === 'paid') {
      if (!this.inDoorWindow(startAt, endAt, now)) return 'awaiting_arrival';
      if (sessionPhase === 'awaiting_arrival') return 'arrival';
      return sessionPhase;
    }

    if (status === 'active' && sessionPhase === 'playing') return 'playing';
    return sessionPhase;
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

    const phase = this.resolvePhase(b.status, b.sessionPhase, b.startAt, b.endAt);
    if (phase !== b.sessionPhase) {
      const updated = await this.prisma.booking.update({
        where: { id: b.id },
        data: { sessionPhase: phase },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
      return this.format(updated);
    }
    return this.format(b);
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
    return list.map((b) => this.format(b));
  }

  async create(
    userId: string,
    seatId: string,
    durationHours: number,
    startAtIso?: string
  ) {
    await this.syncSeatStates();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (!['approved', 'auto_approved'].includes(user.identityStatus)) {
      throw new BadRequestException(
        'Нужна верификация по паспорту. Пройдите проверку в приложении.'
      );
    }

    const seat = await this.prisma.seat.findUnique({
      where: { id: seatId },
      include: { zone: true },
    });
    if (!seat) throw new NotFoundException('Место не найдено');
    if (seat.status === 'repair') {
      throw new BadRequestException('Место на обслуживании');
    }
    if (seat.status !== 'free') {
      throw new BadRequestException('Место уже занято или забронировано');
    }

    const current = await this.getActive(userId);
    if (current) throw new BadRequestException('Уже есть активный сеанс или бронь');

    const startAt = startAtIso ? new Date(startAtIso) : new Date();
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Некорректное время начала');
    }
    const now = new Date();
    if (startAt.getTime() < now.getTime() - 60_000) {
      throw new BadRequestException('Время начала не может быть в прошлом');
    }
    const durationMinutes = Math.round(durationHours * 60);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const totalPrice = seat.zone.pricePerHour * durationHours * 100;

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.seat.update({
        where: { id: seatId },
        data: { status: 'reserved' },
      });
      return tx.booking.create({
        data: {
          userId,
          status: 'pending_payment',
          sessionPhase: 'awaiting_arrival',
          startAt,
          endAt,
          durationMinutes,
          totalPrice,
          seats: {
            create: { seatId, seatNumber: seat.number },
          },
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    });

    return this.format(booking);
  }

  async cancelPending(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId, status: 'pending_payment' },
    });
    if (!booking) return { ok: true };
    await this.releaseBooking(bookingId, 'cancelled');
    return { ok: true };
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
    if (seat.status !== 'reserved') {
      throw new BadRequestException('Место больше недоступно');
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < booking.totalPrice) {
      throw new BadRequestException('Недостаточно средств на балансе');
    }

    const now = new Date();
    const inWindow = this.inDoorWindow(booking.startAt, booking.endAt, now);
    const phase: SessionPhase = inWindow ? 'arrival' : 'awaiting_arrival';
    const walkIn = this.isWalkIn(booking.startAt, now);
    const payEndAt = walkIn
      ? new Date(
          now.getTime() +
            (booking.durationMinutes + ACCEPTANCE_BUFFER_MIN) * 60_000
        )
      : booking.endAt;

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
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'paid',
          sessionPhase: phase,
          ...(walkIn ? { endAt: payEndAt } : {}),
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    });

    return this.format(updated);
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

  async openDoor(userId: string, bookingId: string, type: 'main' | 'cell') {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.sessionPhase === 'issue') {
      throw new BadRequestException('Сеанс на паузе — дождитесь администратора');
    }
    if (!this.inDoorWindow(booking.startAt, booking.endAt)) {
      throw new BadRequestException('Доступ в клуб откроется за 15 минут до начала');
    }

    const club = await this.prisma.club.findFirst();
    const seat = booking.seats[0]?.seat;
    const seatNumber = booking.seats[0]?.seatNumber ?? seat?.number ?? 0;

    let lockId = type === 'main' ? club?.mainDoorLockId : undefined;
    let cellLock = seat?.cellLock?.trim() || seat?.lockId?.trim() || '';

    if (type === 'cell') {
      if (!seat) {
        throw new BadRequestException('Нет места в брони');
      }
      cellLock = await ensureSeatCellLock(this.prisma, seat);
      lockId = cellLock;
    }

    if (!lockId) {
      throw new BadRequestException(
        type === 'main'
          ? 'Главная дверь не настроена в админке (Замки)'
          : 'Замок ячейки не привязан к месту'
      );
    }

    const lockResult = await this.locks.open({
      lockId,
      lockType: type,
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

    let nextPhase = booking.sessionPhase;
    if (type === 'main') {
      if (['awaiting_arrival', 'arrival'].includes(booking.sessionPhase)) {
        nextPhase = 'cell_pending';
      }
    } else {
      nextPhase = 'acceptance';
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { sessionPhase: nextPhase },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });

    void this.lockerLog.write({
      bookingId,
      userId,
      seatId: seat?.id,
      seatNumber,
      cellLock: type === 'cell' ? cellLock : 'main-door',
      type: type === 'main' ? 'lock_open_main' : 'lock_open_cell',
      payload: { lockId, ok: lockResult.ok },
    });

    return {
      ...this.format(updated),
      lockCommandSent: true,
      lockType: type,
    };
  }

  async extendSession(userId: string, bookingId: string, hours: number) {
    if (!hours || hours < 1 || hours > 8) {
      throw new BadRequestException('Продление от 1 до 8 часов');
    }
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.status !== 'active' || booking.sessionPhase !== 'playing') {
      throw new BadRequestException('Продление только во время игры');
    }
    const seat = booking.seats[0]?.seat;
    if (!seat) throw new BadRequestException('Нет места');
    const addKopecks = seat.zone.pricePerHour * hours * 100;
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
          description: `Продление +${hours} ч, место #${booking.seats[0].seatNumber}`,
          externalId: `${bookingId}-ext-${Date.now()}`,
        },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          endAt: new Date(booking.endAt.getTime() + hours * 3600_000),
          durationMinutes: booking.durationMinutes + hours * 60,
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    });

    return this.format(updated);
  }

  async submitAcceptance(
    userId: string,
    bookingId: string,
    dto: SubmitAcceptanceDto,
    photo?: Express.Multer.File
  ) {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (!['acceptance', 'cell_pending', 'arrival'].includes(booking.sessionPhase)) {
      throw new BadRequestException('Приёмка недоступна на этом этапе');
    }

    const photoPath = photo
      ? this.saveBookingPhoto('acceptance', bookingId, photo)
      : null;

    const seatRow = booking.seats[0];
    const seat = seatRow?.seat;
    const cellLock = seat
      ? await ensureSeatCellLock(this.prisma, seat)
      : `cell-${seatRow?.seatNumber ?? 0}`;

    await this.prisma.acceptanceReport.create({
      data: {
        bookingId,
        userId,
        items: dto.items,
        comment: dto.comment?.trim() ?? '',
        hasIssue: dto.hasIssue,
        photoPath,
      },
    });

    void this.lockerLog.write({
      bookingId,
      userId,
      seatId: seat?.id ?? seatRow?.seatId,
      seatNumber: seatRow?.seatNumber ?? seat?.number ?? 0,
      cellLock,
      type: 'acceptance',
      photoPath,
      payload: {
        items: dto.items,
        hasIssue: dto.hasIssue,
        comment: dto.comment?.trim() ?? '',
      },
    });

    if (dto.hasIssue) {
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { sessionPhase: 'issue' },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
      return this.format(updated);
    }

    const now = new Date();
    const walkIn = this.isWalkIn(booking.startAt, now);
    const startedAt = walkIn
      ? now
      : booking.startAt > now
        ? booking.startAt
        : now;
    const endAt = walkIn
      ? new Date(now.getTime() + booking.durationMinutes * 60_000)
      : booking.endAt;

    const seatId = booking.seats[0].seatId;
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
          startedAt,
          endAt,
        },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
    });

    const seatNum = updated.seats[0]?.seatNumber ?? 0;
    void this.notifications.notifySessionStarted(userId, bookingId, seatNum);

    return this.format(updated);
  }

  async startCheckout(userId: string, bookingId: string) {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.status !== 'active' || booking.sessionPhase !== 'playing') {
      throw new BadRequestException('Завершение доступно во время игры');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { sessionPhase: 'checkout' },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });
    return this.format(updated);
  }

  async completeCheckout(
    userId: string,
    bookingId: string,
    photo?: Express.Multer.File
  ) {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.sessionPhase !== 'checkout') {
      throw new BadRequestException('Сначала начните завершение сеанса');
    }
    const photoPath = photo
      ? this.saveBookingPhoto('checkout', bookingId, photo)
      : booking.checkoutPhotoPath;
    if (!photoPath) {
      throw new BadRequestException('Сделайте фото ячейки перед завершением');
    }
    if (photo) {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { checkoutPhotoPath: photoPath },
      });
    }

    const now = new Date();
    const remainingMs = booking.endAt.getTime() - now.getTime();
    const remainingMin = Math.floor(remainingMs / 60_000);

    let refundKopecks = 0;
    if (remainingMin >= REFUND_MIN_REMAINING_MIN) {
      const slotMin = 30;
      const unusedSlots = Math.floor(remainingMin / slotMin);
      const pricePerMin = booking.totalPrice / booking.durationMinutes;
      refundKopecks = Math.round(unusedSlots * slotMin * pricePerMin);
      refundKopecks = Math.min(refundKopecks, booking.totalPrice);
    }

    const seatRow = booking.seats[0];
    const seat = seatRow?.seat;
    const cellLock =
      seat?.cellLock?.trim() ||
      seat?.lockId?.trim() ||
      (seat ? await ensureSeatCellLock(this.prisma, seat) : `cell-${seatRow?.seatNumber ?? 0}`);

    void this.lockerLog.write({
      bookingId,
      userId,
      seatId: seat?.id ?? seatRow?.seatId,
      seatNumber: seatRow?.seatNumber ?? seat?.number ?? 0,
      cellLock,
      type: 'checkout',
      photoPath,
      payload: { refundKopecks },
    });

    await this.prisma.$transaction(async (tx) => {
      if (refundKopecks > 0) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: refundKopecks } },
          });
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'refund',
              amount: refundKopecks,
              description: 'Возврат за досрочное завершение',
              externalId: `${bookingId}-checkout`,
            },
          });
        }
      }
      await tx.booking.update({
        where: { id: bookingId },
        data: { endAt: now },
      });
    });

    await this.releaseBooking(bookingId, 'completed');
    void this.notifications.notifySessionEnded(userId, bookingId);
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      ok: true,
      refundRub: Math.round(refundKopecks / 100),
      balanceRub: Math.round((wallet?.balance ?? 0) / 100),
    };
  }

  async saveCheckoutPhoto(
    userId: string,
    bookingId: string,
    photo: Express.Multer.File
  ) {
    const booking = await this.getOngoingBooking(userId, bookingId);
    if (booking.sessionPhase !== 'checkout') {
      throw new BadRequestException('Сначала начните завершение сеанса');
    }
    const photoPath = this.saveBookingPhoto('checkout', bookingId, photo);
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { checkoutPhotoPath: photoPath },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
    });
    return this.format(updated);
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
      for (const s of booking.seats) {
        await tx.seat.update({
          where: { id: s.seatId },
          data: { status: 'free' },
        });
      }
    });
  }

  private format(booking: {
    id: string;
    status: BookingStatus;
    sessionPhase: SessionPhase;
    startAt: Date;
    endAt: Date;
    startedAt: Date | null;
    durationMinutes: number;
    totalPrice: number;
    seats: { seatNumber: number; seat: { zone: { name: string } } }[];
  }) {
    const now = new Date();
    const zoneName = booking.seats[0]?.seat.zone.name ?? '';
    const phase = this.resolvePhase(
      booking.status,
      booking.sessionPhase,
      booking.startAt,
      booking.endAt,
      now
    );
    const gameRunning =
      booking.status === 'active' &&
      phase === 'playing' &&
      booking.startedAt != null;
    const doorOpen = this.inDoorWindow(booking.startAt, booking.endAt, now);
    const untilStartMs = Math.max(0, booking.startAt.getTime() - now.getTime());
    const untilEndMs = Math.max(0, booking.endAt.getTime() - now.getTime());
    const doorOpensMs = Math.max(
      0,
      this.doorWindowStart(booking.startAt).getTime() - now.getTime()
    );
    const paidDurationMs = booking.durationMinutes * 60_000;

    let timerMode: string;
    let displayRemainingMs: number;
    let timerLabel: string;

    if (phase === 'issue') {
      timerMode = 'paused';
      displayRemainingMs = untilEndMs;
      timerLabel = 'на паузе';
    } else if (gameRunning) {
      timerMode = 'playing';
      displayRemainingMs = untilEndMs;
      timerLabel = 'осталось';
    } else if (booking.status === 'paid' && !booking.startedAt) {
      if (doorOpensMs > 0) {
        timerMode = 'until_door';
        displayRemainingMs = doorOpensMs;
        timerLabel = 'до входа в клуб';
      } else if (untilStartMs > 0) {
        timerMode = 'until_start';
        displayRemainingMs = untilStartMs;
        timerLabel = 'до начала';
      } else {
        timerMode = 'pre_play';
        displayRemainingMs = paidDurationMs;
        timerLabel = 'после приёмки';
      }
    } else {
      timerMode = 'until_end';
      displayRemainingMs = untilEndMs;
      timerLabel = 'осталось';
    }

    return {
      id: booking.id,
      seatNumbers: booking.seats.map((s) => s.seatNumber),
      zoneName,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      startedAt: booking.startedAt?.toISOString() ?? null,
      durationMinutes: booking.durationMinutes,
      totalPrice: Math.round(booking.totalPrice / 100),
      status: booking.status,
      sessionPhase: phase,
      gameRunning,
      timerMode,
      timerLabel,
      displayRemainingMs,
      doorWindowOpen: doorOpen,
      untilStartMs,
      untilEndMs,
      canOpenMainDoor:
        doorOpen &&
        !['issue', 'checkout', 'acceptance'].includes(phase) &&
        ['awaiting_arrival', 'arrival', 'cell_pending'].includes(phase),
      canOpenCell:
        doorOpen &&
        !['issue', 'checkout'].includes(phase) &&
        phase !== 'playing',
      needsAcceptance: phase === 'acceptance',
    };
  }

}
