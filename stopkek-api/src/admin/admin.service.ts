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
import { join } from 'path';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { BookingsService } from '../bookings/bookings.service';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { UpsertDurationPackageDto } from './dto/upsert-duration-package.dto';
import { UpsertNightPricingDto } from './dto/upsert-night-pricing.dto';
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
      lockId: s.lockId,
      cellLock: s.cellLock,
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
              { deletedPhone: { contains: q.replace(/\D/g, '') } },
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
      phone: u.deletedAt ? (u.deletedPhone ?? u.phone) : u.phone,
      name: u.name || 'Игрок',
      email: u.email,
      profileCompleted: u.profileCompleted,
      identityStatus: u.identityStatus,
      identityVerified: IDENTITY_VERIFIED.includes(u.identityStatus),
      balanceRub: Math.round((u.wallet?.balance ?? 0) / 100),
      bookingsCount: u._count.bookings,
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
      isDeleted: Boolean(u.deletedAt),
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
      phone: u.deletedAt ? (u.deletedPhone ?? u.phone) : u.phone,
      name: u.name || 'Игрок',
      email: u.email,
      profileCompleted: u.profileCompleted,
      identityStatus: u.identityStatus,
      identityVerified: IDENTITY_VERIFIED.includes(u.identityStatus),
      balanceRub: Math.round((u.wallet?.balance ?? 0) / 100),
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
      isDeleted: Boolean(u.deletedAt),
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
        wallet: {
          include: {
            user: { select: { phone: true, name: true, deletedAt: true, deletedPhone: true } },
          },
        },
      },
    });
    return list.map((t) => ({
      id: t.id,
      type: t.type,
      amountRub: t.amount / 100,
      description: t.description,
      createdAt: t.createdAt,
      userPhone: t.wallet.user.deletedAt
        ? (t.wallet.user.deletedPhone ?? t.wallet.user.phone)
        : t.wallet.user.phone,
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
      sessionPhase?: string;
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
      sessionPhase: b.sessionPhase ?? null,
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

  async listAcceptanceReports(resolved?: boolean) {
    const list = await this.prisma.acceptanceReport.findMany({
      where: {
        hasIssue: true,
        ...(resolved === undefined ? {} : { resolved }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        booking: {
          include: {
            seats: true,
            user: { select: { id: true, phone: true, name: true } },
          },
        },
      },
    });
    return list.map((r) => ({
      id: r.id,
      bookingId: r.bookingId,
      comment: r.comment,
      items: r.items as Record<string, boolean>,
      hasIssue: r.hasIssue,
      resolved: r.resolved,
      createdAt: r.createdAt.toISOString(),
      seatNumber: r.booking.seats[0]?.seatNumber ?? 0,
      userPhone: r.booking.user.phone,
      userName: r.booking.user.name || 'Игрок',
    }));
  }

  async resolveAcceptanceReport(reportId: string) {
    const report = await this.prisma.acceptanceReport.findUnique({
      where: { id: reportId },
      include: { booking: { include: { seats: true } } },
    });
    if (!report) throw new NotFoundException('Заявка не найдена');

    await this.prisma.acceptanceReport.update({
      where: { id: reportId },
      data: { resolved: true },
    });

    if (report.booking.sessionPhase === 'issue') {
      const now = new Date();
      const walkIn =
        report.booking.startAt.getTime() <= now.getTime() + 10 * 60 * 1000;
      const startedAt = walkIn
        ? now
        : report.booking.startAt > now
          ? report.booking.startAt
          : now;
      const endAt = walkIn
        ? new Date(now.getTime() + report.booking.durationMinutes * 60_000)
        : report.booking.endAt;
      const seatId = report.booking.seats[0]?.seatId;
      if (seatId) {
        await this.prisma.$transaction(async (tx) => {
          await tx.seat.update({
            where: { id: seatId },
            data: { status: 'occupied' },
          });
          await tx.booking.update({
            where: { id: report.bookingId },
            data: {
              status: 'active',
              sessionPhase: 'playing',
              startedAt,
              endAt,
            },
          });
        });
      }
    }
    return { ok: true };
  }

  async purgeAccessLogs() {
    const legacy = await this.prisma.lockerLog.deleteMany({
      where: { type: { in: ['acceptance', 'checkout'] } },
    });
    const events = await this.prisma.lockEvent.deleteMany();
    return {
      ok: true,
      removedLegacy: legacy.count,
      removedLockEvents: events.count,
    };
  }

  async listLockerLogs(params: {
    seatNumber?: number;
    cellLock?: string;
    limit?: number;
    types?: string[];
  }) {
    const limit = Math.min(params.limit ?? 80, 200);
    const typeFilter =
      params.types?.length &&
      params.types.every((t) =>
        ['lock_open_main', 'lock_open_cell', 'acceptance', 'checkout'].includes(t)
      )
        ? params.types
        : ['lock_open_main'];

    const list = await this.prisma.lockerLog.findMany({
      where: {
        type: { in: typeFilter as ('lock_open_main' | 'lock_open_cell')[] },
        ...(params.seatNumber != null
          ? { seatNumber: params.seatNumber }
          : {}),
        ...(params.cellLock?.trim()
          ? { cellLock: params.cellLock.trim() }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, phone: true, name: true } },
        booking: {
          select: {
            id: true,
            status: true,
            sessionPhase: true,
            totalPrice: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });
    return list.map((r) => ({
      id: r.id,
      type: r.type,
      bookingId: r.bookingId,
      seatNumber: r.seatNumber,
      cellLock: r.cellLock,
      photoPath: r.photoPath,
      hasPhoto: Boolean(r.photoPath),
      payload: r.payload,
      createdAt: r.createdAt.toISOString(),
      userId: r.userId,
      userPhone: r.user.phone,
      userName: r.user.name || 'Игрок',
      bookingStatus: r.booking?.status ?? null,
      bookingPhase: r.booking?.sessionPhase ?? null,
      bookingStartAt: r.booking?.startAt.toISOString() ?? null,
      bookingEndAt: r.booking?.endAt.toISOString() ?? null,
      bookingTotalRub: r.booking
        ? Math.round(r.booking.totalPrice / 100)
        : null,
      lockOk:
        r.payload &&
        typeof r.payload === 'object' &&
        'ok' in (r.payload as object)
          ? Boolean((r.payload as { ok?: boolean }).ok)
          : null,
    }));
  }

  async streamLockerPhoto(logId: string, res: Response) {
    const log = await this.prisma.lockerLog.findUnique({
      where: { id: logId },
    });
    if (!log?.photoPath) throw new NotFoundException('Фото не найдено');
    const abs = join(process.cwd(), 'uploads', log.photoPath);
    if (!existsSync(abs)) throw new NotFoundException('Файл не найден');
    const ext = log.photoPath.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    createReadStream(abs).pipe(res);
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

  private async requireClub() {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new BadRequestException('Клуб не найден');
    return club;
  }

  async listPricing() {
    const club = await this.requireClub();
    const [packages, nightRules, zones] = await Promise.all([
      this.prisma.durationPackage.findMany({
        where: { clubId: club.id },
        orderBy: [{ sortOrder: 'asc' }, { minHours: 'asc' }],
      }),
      this.prisma.nightPricing.findMany({ where: { clubId: club.id } }),
      this.prisma.zone.findMany({
        where: { clubId: club.id },
        select: { id: true, name: true, slug: true, pricePerHour: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return {
      packages: packages.map((p) => ({
        id: p.id,
        zoneId: p.zoneId,
        minHours: p.minHours,
        discountPercent: p.discountPercent,
        label: p.label,
        badge: p.badge,
        recommended: p.recommended,
        sortOrder: p.sortOrder,
        active: p.active,
      })),
      nightRules: nightRules.map((n) => ({
        id: n.id,
        zoneId: n.zoneId,
        startHour: n.startHour,
        endHour: n.endHour,
        discountPercent: n.discountPercent,
        active: n.active,
      })),
      zones,
    };
  }

  async createDurationPackage(dto: UpsertDurationPackageDto) {
    const club = await this.requireClub();
    if (dto.zoneId) {
      const z = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, clubId: club.id },
      });
      if (!z) throw new BadRequestException('Зона не найдена');
    }
    const maxOrder = await this.prisma.durationPackage.aggregate({
      where: { clubId: club.id },
      _max: { sortOrder: true },
    });
    return this.prisma.durationPackage.create({
      data: {
        clubId: club.id,
        zoneId: dto.zoneId ?? null,
        minHours: dto.minHours,
        discountPercent: dto.discountPercent,
        label: dto.label.trim(),
        badge: dto.badge?.trim() || null,
        recommended: dto.recommended ?? false,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        active: dto.active ?? true,
      },
    });
  }

  async updateDurationPackage(id: string, dto: UpsertDurationPackageDto) {
    const pkg = await this.prisma.durationPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Пакет не найден');
    if (dto.zoneId) {
      const z = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, clubId: pkg.clubId },
      });
      if (!z) throw new BadRequestException('Зона не найдена');
    }
    return this.prisma.durationPackage.update({
      where: { id },
      data: {
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId || null } : {}),
        minHours: dto.minHours,
        discountPercent: dto.discountPercent,
        label: dto.label.trim(),
        badge: dto.badge?.trim() || null,
        ...(dto.recommended !== undefined ? { recommended: dto.recommended } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async deleteDurationPackage(id: string) {
    await this.prisma.durationPackage.delete({ where: { id } });
    return { ok: true };
  }

  async createNightPricing(dto: UpsertNightPricingDto) {
    const club = await this.requireClub();
    if (dto.zoneId) {
      const z = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, clubId: club.id },
      });
      if (!z) throw new BadRequestException('Зона не найдена');
    }
    return this.prisma.nightPricing.create({
      data: {
        clubId: club.id,
        zoneId: dto.zoneId ?? null,
        startHour: dto.startHour,
        endHour: dto.endHour,
        discountPercent: dto.discountPercent,
        active: dto.active ?? true,
      },
    });
  }

  async updateNightPricing(id: string, dto: UpsertNightPricingDto) {
    const club = await this.requireClub();
    const row = await this.prisma.nightPricing.findFirst({
      where: { id, clubId: club.id },
    });
    if (!row) throw new NotFoundException('Правило не найдено');
    if (dto.zoneId) {
      const z = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, clubId: club.id },
      });
      if (!z) throw new BadRequestException('Зона не найдена');
    }
    return this.prisma.nightPricing.update({
      where: { id },
      data: {
        zoneId: dto.zoneId === undefined ? undefined : dto.zoneId ?? null,
        startHour: dto.startHour,
        endHour: dto.endHour,
        discountPercent: dto.discountPercent,
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async upsertNightPricing(dto: UpsertNightPricingDto) {
    const club = await this.requireClub();
    if (dto.zoneId) {
      const z = await this.prisma.zone.findFirst({
        where: { id: dto.zoneId, clubId: club.id },
      });
      if (!z) throw new BadRequestException('Зона не найдена');
    }
    const existing = await this.prisma.nightPricing.findFirst({
      where: { clubId: club.id, zoneId: dto.zoneId ?? null },
    });
    if (existing) {
      return this.prisma.nightPricing.update({
        where: { id: existing.id },
        data: {
          startHour: dto.startHour,
          endHour: dto.endHour,
          discountPercent: dto.discountPercent,
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    }
    return this.prisma.nightPricing.create({
      data: {
        clubId: club.id,
        zoneId: dto.zoneId ?? null,
        startHour: dto.startHour,
        endHour: dto.endHour,
        discountPercent: dto.discountPercent,
        active: dto.active ?? true,
      },
    });
  }

  async deleteNightPricing(id: string) {
    await this.prisma.nightPricing.delete({ where: { id } });
    return { ok: true };
  }
}
