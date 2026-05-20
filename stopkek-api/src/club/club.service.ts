import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class ClubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService
  ) {}

  async getClub() {
    const club = await this.prisma.club.findFirst({
      include: { zones: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!club) throw new NotFoundException('Клуб не найден');
    return {
      id: club.id,
      name: club.name,
      address: club.address,
      rating: club.rating,
      hours: club.hours,
      supportEmail: club.supportEmail,
      zones: club.zones.map((z) => ({
        id: z.slug,
        name: z.name,
        specs: z.specs,
        pricePerHour: z.pricePerHour,
      })),
    };
  }

  async getFloorMap() {
    await this.bookings.syncSeatStates();

    const club = await this.prisma.club.findFirst({
      include: {
        zones: {
          orderBy: { sortOrder: 'asc' },
          include: { seats: { orderBy: { number: 'asc' } } },
        },
      },
    });
    if (!club) throw new NotFoundException('Клуб не найден');

    return {
      club: {
        id: club.id,
        name: club.name,
        address: club.address,
        rating: club.rating,
      },
      zones: club.zones.map((z) => ({
        id: z.slug,
        name: z.name,
        specs: z.specs,
        pricePerHour: z.pricePerHour,
        labelX: z.labelX,
        labelY: z.labelY,
      })),
      seats: club.zones.flatMap((z) =>
        z.seats.map((s) => ({
          id: s.id,
          number: s.number,
          zoneId: z.slug,
          x: s.x,
          y: s.y,
          w: s.w,
          h: s.h,
          status: s.status,
        }))
      ),
    };
  }
}
