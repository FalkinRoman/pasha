import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  IdentityStatus,
  SeatStatus,
  TransactionType,
} from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { BookingsService } from '../bookings/bookings.service';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';

const IDENTITY_VERIFIED: IdentityStatus[] = ['approved', 'auto_approved'];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly identity: IdentityService,
    private readonly auth: AuthService
  ) {}

  generateUserLoginCode(userId: string) {
    return this.prisma.user
      .findUnique({ where: { id: userId }, select: { phone: true } })
      .then((u) => {
        if (!u) throw new NotFoundException('Пользователь не найден');
        return this.auth.issueAdminLoginCode(u.phone);
      });
  }

  async getDashboard() {
    await this.bookings.syncSeatStates();
    const pendingVerifications = await this.identity.processAutoApprovals();

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

    const pendingCount = await this.prisma.identityVerification.count({
      where: { status: 'pending' },
    });

    return {
      usersCount,
      bookingsToday,
      revenueTodayRub: Math.round((revenueAgg._sum.amount ?? 0) / 100),
      occupancyPercent: totalSeats
        ? Math.round((busy / totalSeats) * 100)
        : 0,
      pendingVerifications: pendingCount,
      autoApprovedNow: pendingVerifications,
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

  async createSeat(dto: CreateSeatDto) {
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone) throw new NotFoundException('Зона не найдена');

    const dup = await this.prisma.seat.findUnique({
      where: { zoneId_number: { zoneId: dto.zoneId, number: dto.number } },
    });
    if (dup) {
      throw new BadRequestException(
        `Место №${dto.number} уже есть в зоне ${zone.name}`
      );
    }

    const { x, y } =
      dto.x !== undefined && dto.y !== undefined
        ? { x: dto.x, y: dto.y }
        : await this.nextSeatPosition(dto.zoneId);

    return this.prisma.seat.create({
      data: {
        zoneId: dto.zoneId,
        number: dto.number,
        status: dto.status ?? 'free',
        x,
        y,
      },
    });
  }

  async updateSeat(seatId: string, dto: UpdateSeatDto) {
    const seat = await this.prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) throw new NotFoundException('Место не найдено');

    const zoneId = dto.zoneId ?? seat.zoneId;
    const number = dto.number ?? seat.number;

    if (dto.zoneId !== undefined || dto.number !== undefined) {
      const dup = await this.prisma.seat.findFirst({
        where: { zoneId, number, NOT: { id: seatId } },
      });
      if (dup) {
        throw new BadRequestException(`Место №${number} уже занято в этой зоне`);
      }
    }

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
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
      },
    });
  }

  async deleteSeat(seatId: string) {
    const seat = await this.prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) throw new NotFoundException('Место не найдено');

    await this.assertSeatDeletable(seatId, seat.number);
    await this.prisma.seat.delete({ where: { id: seatId } });
    return { ok: true };
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

  async createZone(dto: CreateZoneDto) {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new BadRequestException('Клуб не найден — npm run bootstrap:club');

    const exists = await this.prisma.zone.findUnique({
      where: { clubId_slug: { clubId: club.id, slug: dto.slug } },
    });
    if (exists) throw new BadRequestException(`Зона ${dto.slug} уже существует`);

    const maxOrder = await this.prisma.zone.aggregate({
      where: { clubId: club.id },
      _max: { sortOrder: true },
    });

    return this.prisma.zone.create({
      data: {
        clubId: club.id,
        slug: dto.slug,
        name: dto.name.trim(),
        specs: dto.specs?.trim() ?? '',
        pricePerHour: dto.pricePerHour,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
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

  async deleteZone(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: { _count: { select: { seats: true } } },
    });
    if (!zone) throw new NotFoundException('Зона не найдена');

    if (zone._count.seats > 0) {
      throw new BadRequestException(
        `Сначала удалите все места в зоне (${zone._count.seats})`
      );
    }

    await this.prisma.zone.delete({ where: { id: zoneId } });
    return { ok: true };
  }

  private async assertSeatDeletable(seatId: string, seatNumber: number) {
    const active = await this.prisma.bookingSeat.findFirst({
      where: {
        seatId,
        booking: { status: { in: ['active', 'paid', 'pending_payment'] } },
      },
    });
    if (active) {
      throw new BadRequestException(
        `Место №${seatNumber} в активной брони — сначала отмените бронь`
      );
    }

    const history = await this.prisma.bookingSeat.count({ where: { seatId } });
    if (history > 0) {
      throw new BadRequestException(
        `Место №${seatNumber} уже было в бронях — удалить нельзя`
      );
    }
  }

  private async nextSeatPosition(zoneId: string) {
    const SEAT_W = 22;
    const SEAT_H = 22;
    const STEP = SEAT_W + 4;
    const GRID_X = 12 + 74 + 10;
    const GRID_Y = 32;

    const inZone = await this.prisma.seat.findMany({
      where: { zoneId },
      orderBy: { number: 'desc' },
      take: 1,
    });

    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    const row = zone?.sortOrder ?? 0;
    const col = inZone.length;

    return {
      x: GRID_X + col * STEP,
      y: GRID_Y + row * STEP,
    };
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
      identityStatus: u.identityStatus,
      identityVerified: IDENTITY_VERIFIED.includes(u.identityStatus),
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
        identityVerifications: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!u) throw new NotFoundException('Пользователь не найден');

    const latest = u.identityVerifications[0] ?? null;

    return {
      id: u.id,
      phone: u.phone,
      name: u.name || 'Игрок',
      email: u.email,
      profileCompleted: u.profileCompleted,
      identityStatus: u.identityStatus,
      identityVerified: IDENTITY_VERIFIED.includes(u.identityStatus),
      balanceRub: Math.round((u.wallet?.balance ?? 0) / 100),
      createdAt: u.createdAt,
      verification: latest
        ? {
            id: latest.id,
            status: latest.status,
            submittedAt: latest.submittedAt,
            resolvedAt: latest.resolvedAt,
            rejectReason: latest.rejectReason,
            photoUrl: `/admin/verifications/${latest.id}/photo`,
          }
        : null,
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

  listVerifications() {
    return this.identity.listPendingForAdmin();
  }

  approveVerification(id: string, adminId: string) {
    return this.identity.approve(id, adminId);
  }

  rejectVerification(id: string, adminId: string, reason: string) {
    return this.identity.reject(id, adminId, reason);
  }

  async streamVerificationPhoto(id: string, res: Response) {
    const v = await this.prisma.identityVerification.findUnique({
      where: { id },
    });
    if (!v) throw new NotFoundException('Заявка не найдена');
    const path = this.identity.getPhotoAbsolutePath(v.photoPath);
    if (!existsSync(path)) throw new NotFoundException('Фото не найдено');
    res.setHeader('Content-Type', 'image/jpeg');
    createReadStream(path).pipe(res);
  }
}
