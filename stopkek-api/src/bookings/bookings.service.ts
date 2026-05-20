import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SeatStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PENDING_MS_DEFAULT = 15 * 60 * 1000;

@Injectable()
export class BookingsService {
  private readonly pendingMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    this.pendingMs =
      Number(config.get('BOOKING_PENDING_TTL_SEC', 900)) * 1000 || PENDING_MS_DEFAULT;
  }

  /** Просроченные pending → cancelled, истёкшие active → completed, места free */
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

    const expiredActive = await this.prisma.booking.findMany({
      where: { status: 'active', endAt: { lte: now } },
      include: { seats: true },
    });
    for (const b of expiredActive) {
      await this.releaseBooking(b.id, 'completed');
    }
  }

  async getActive(userId: string) {
    await this.syncSeatStates();
    const b = await this.prisma.booking.findFirst({
      where: { userId, status: 'active', endAt: { gt: new Date() } },
      include: { seats: { include: { seat: { include: { zone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return b ? this.format(b) : null;
  }

  async getHistory(userId: string) {
    await this.syncSeatStates();
    const list = await this.prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['completed', 'cancelled', 'active', 'paid'] },
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

    const active = await this.getActive(userId);
    if (active) throw new BadRequestException('Уже есть активный сеанс');

    const startAt = startAtIso ? new Date(startAtIso) : new Date();
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Некорректное время начала');
    }
    const now = new Date();
    if (startAt.getTime() < now.getTime() - 60_000) {
      throw new BadRequestException('Время начала не может быть в прошлом');
    }
    const endAt = new Date(startAt.getTime() + durationHours * 3600_000);
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
          startAt,
          endAt,
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

    const seatId = booking.seats[0].seatId;

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
      await tx.seat.update({
        where: { id: seatId },
        data: { status: 'occupied' },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: 'active' },
        include: { seats: { include: { seat: { include: { zone: true } } } } },
      });
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
    startAt: Date;
    endAt: Date;
    totalPrice: number;
    seats: { seatNumber: number; seat: { zone: { name: string } } }[];
  }) {
    const zoneName = booking.seats[0]?.seat.zone.name ?? '';
    return {
      id: booking.id,
      seatNumbers: booking.seats.map((s) => s.seatNumber),
      zoneName,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      totalPrice: Math.round(booking.totalPrice / 100),
      status: booking.status,
    };
  }
}
