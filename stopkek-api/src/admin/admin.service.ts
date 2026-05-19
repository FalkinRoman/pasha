import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, SeatStatus, TransactionType } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService
  ) {}

  async getDashboard() {
    await this.bookings.syncSeatStates();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      usersCount,
      bookingsToday,
      seats,
      revenueAgg,
      recentBookings,
      recentFeedback,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.booking.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.seat.findMany({ select: { status: true } }),
      this.prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startOfDay },
          type: { in: ['topup', 'booking_payment'] },
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { phone: true, name: true } },
          seats: true,
        },
      }),
      this.prisma.feedback.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { phone: true, name: true } } },
      }),
    ]);

    const totalSeats = seats.length;
    const busy = seats.filter((s) =>
      ['occupied', 'reserved'].includes(s.status)
    ).length;

    return {
      usersCount,
      bookingsToday,
      revenueTodayRub: Math.round((revenueAgg._sum.amount ?? 0) / 100),
      occupancyPercent: totalSeats
        ? Math.round((busy / totalSeats) * 100)
        : 0,
      seatsByStatus: {
        free: seats.filter((s) => s.status === 'free').length,
        occupied: seats.filter((s) => s.status === 'occupied').length,
        reserved: seats.filter((s) => s.status === 'reserved').length,
        repair: seats.filter((s) => s.status === 'repair').length,
      },
      recentBookings: recentBookings.map((b) => this.formatBooking(b)),
      recentFeedback: recentFeedback.map((f) => ({
        id: f.id,
        rating: f.rating,
        message: f.message,
        createdAt: f.createdAt,
        userPhone: f.user.phone,
        userName: f.user.name || 'Игрок',
      })),
    };
  }

  async listSeats() {
    await this.bookings.syncSeatStates();
    const seats = await this.prisma.seat.findMany({
      orderBy: { number: 'asc' },
      include: { zone: true },
    });
    return seats.map((s) => ({
      id: s.id,
      number: s.number,
      status: s.status,
      zoneId: s.zone.id,
      zoneSlug: s.zone.slug,
      zoneName: s.zone.name,
      pricePerHour: s.zone.pricePerHour,
      specs: s.zone.specs,
    }));
  }

  async updateSeat(seatId: string, dto: UpdateSeatDto) {
    const seat = await this.prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) throw new NotFoundException('Место не найдено');

    if (dto.status === 'free' && seat.status === 'occupied') {
      const active = await this.prisma.bookingSeat.findFirst({
        where: {
          seatId,
          booking: { status: 'active' },
        },
      });
      if (active) {
        throw new BadRequestException(
          'Нельзя освободить место с активной бронью — сначала завершите бронь'
        );
      }
    }

    return this.prisma.seat.update({
      where: { id: seatId },
      data: { status: dto.status },
    });
  }

  async listZones() {
    const zones = await this.prisma.zone.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { seats: true } } },
    });
    return zones.map((z) => ({
      id: z.id,
      slug: z.slug,
      name: z.name,
      specs: z.specs,
      pricePerHour: z.pricePerHour,
      seatsCount: z._count.seats,
    }));
  }

  async updateZone(zoneId: string, dto: UpdateZoneDto) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException('Зона не найдена');
    return this.prisma.zone.update({
      where: { id: zoneId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.specs !== undefined ? { specs: dto.specs } : {}),
        ...(dto.pricePerHour !== undefined ? { pricePerHour: dto.pricePerHour } : {}),
      },
    });
  }

  async listBookings(status?: BookingStatus) {
    await this.bookings.syncSeatStates();
    const list = await this.prisma.booking.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, phone: true, name: true } },
        seats: { include: { seat: { include: { zone: true } } } },
      },
    });
    return list.map((b) => this.formatBooking(b));
  }

  async cancelBooking(bookingId: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!b) throw new NotFoundException('Бронь не найдена');
    if (!['pending_payment', 'paid', 'active'].includes(b.status)) {
      throw new BadRequestException('Бронь нельзя отменить в текущем статусе');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' },
      });
      for (const bs of b.seats) {
        await tx.seat.update({
          where: { id: bs.seatId },
          data: { status: 'free' },
        });
      }
    });

    return { ok: true };
  }

  async listUsers(search?: string) {
    const q = search?.trim();
    const users = await this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { phone: { contains: q.replace(/\D/g, '') } },
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { wallet: true, _count: { select: { bookings: true } } },
    });

    return users.map((u) => ({
      id: u.id,
      phone: u.phone,
      name: u.name || 'Игрок',
      email: u.email,
      profileCompleted: u.profileCompleted,
      balanceRub: Math.round((u.wallet?.balance ?? 0) / 100),
      bookingsCount: u._count.bookings,
      createdAt: u.createdAt,
    }));
  }

  async getUser(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { seats: true },
        },
      },
    });
    if (!u) throw new NotFoundException('Пользователь не найден');

    return {
      id: u.id,
      phone: u.phone,
      name: u.name || 'Игрок',
      email: u.email,
      profileCompleted: u.profileCompleted,
      balanceRub: Math.round((u.wallet?.balance ?? 0) / 100),
      createdAt: u.createdAt,
      bookings: u.bookings.map((b) => this.formatBooking(b)),
      transactions: (u.wallet?.transactions ?? []).map((t) => ({
        id: t.id,
        type: t.type,
        amountRub: t.amount / 100,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }

  async adjustWallet(userId: string, dto: WalletAdjustDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Кошелёк не найден');

    const next = wallet.balance + dto.amountKopecks;
    if (next < 0) throw new BadRequestException('Баланс не может быть отрицательным');

    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: next },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.refund,
          amount: dto.amountKopecks,
          description: dto.description?.trim() || 'Корректировка админом',
        },
      }),
    ]);

    return { balanceRub: Math.round(next / 100) };
  }

  async listTransactions() {
    const list = await this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        wallet: { include: { user: { select: { phone: true, name: true } } } },
      },
    });
    return list.map((t) => ({
      id: t.id,
      type: t.type,
      amountRub: t.amount / 100,
      description: t.description,
      createdAt: t.createdAt,
      userPhone: t.wallet.user.phone,
      userName: t.wallet.user.name || 'Игрок',
    }));
  }

  async listFeedback() {
    const list = await this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { phone: true, name: true } } },
    });
    return list.map((f) => ({
      id: f.id,
      rating: f.rating,
      message: f.message,
      createdAt: f.createdAt,
      userPhone: f.user.phone,
      userName: f.user.name || 'Игрок',
    }));
  }

  private formatBooking(
    b: {
      id: string;
      status: BookingStatus;
      startAt: Date;
      endAt: Date;
      totalPrice: number;
      createdAt: Date;
      user?: { id?: string; phone: string; name: string };
      seats: Array<{
        seatNumber: number;
        seat?: { zone?: { name: string; slug: string } };
      }>;
    }
  ) {
    return {
      id: b.id,
      status: b.status,
      startAt: b.startAt,
      endAt: b.endAt,
      totalPriceRub: Math.round(b.totalPrice / 100),
      createdAt: b.createdAt,
      userPhone: b.user?.phone,
      userName: b.user?.name || 'Игрок',
      userId: b.user?.id,
      seats: b.seats.map((s) => ({
        number: s.seatNumber,
        zoneName: s.seat?.zone?.name,
        zoneSlug: s.seat?.zone?.slug,
      })),
    };
  }
}
