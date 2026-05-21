import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { UpdateClubDto } from '../admin/dto/update-club.dto';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

@Injectable()
export class ClubService {
  private readonly uploadRoot = join(process.cwd(), 'uploads', 'club');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService
  ) {
    mkdirSync(this.uploadRoot, { recursive: true });
  }

  private mapClub(club: {
    id: string;
    name: string;
    address: string;
    rating: number;
    hours: string;
    imagePath: string | null;
    supportPhone: string | null;
    supportTelegram: string | null;
    supportEmail: string | null;
    zones?: { slug: string; name: string; specs: string; pricePerHour: number }[];
  }) {
    return {
      id: club.id,
      name: club.name,
      address: club.address,
      rating: club.rating,
      hours: club.hours,
      imageUrl: club.imagePath ? '/club/image' : null,
      supportPhone: club.supportPhone,
      supportTelegram: club.supportTelegram,
      supportEmail: club.supportEmail,
      zones: club.zones?.map((z) => ({
        id: z.slug,
        name: z.name,
        specs: z.specs,
        pricePerHour: z.pricePerHour,
      })),
    };
  }

  async getClub() {
    const club = await this.prisma.club.findFirst({
      include: { zones: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!club) throw new NotFoundException('Клуб не найден');
    return this.mapClub(club);
  }

  async getClubSettings() {
    const club = await this.prisma.club.findFirst({
      include: { zones: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!club) throw new NotFoundException('Клуб не найден');
    return {
      ...this.mapClub(club),
      lockProvider: club.lockProvider,
      mainDoorLockId: club.mainDoorLockId,
      lockHttpBaseUrl: club.lockHttpBaseUrl,
      lockHttpToken: club.lockHttpToken ? '••••••••' : null,
      lockMqttTopic: club.lockMqttTopic,
    };
  }

  async updateClubSettings(dto: UpdateClubDto) {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new NotFoundException('Клуб не найден');
    const updated = await this.prisma.club.update({
      where: { id: club.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.hours !== undefined ? { hours: dto.hours.trim() } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.supportPhone !== undefined
          ? { supportPhone: dto.supportPhone.trim() || null }
          : {}),
        ...(dto.supportTelegram !== undefined
          ? { supportTelegram: dto.supportTelegram.trim() || null }
          : {}),
        ...(dto.supportEmail !== undefined
          ? { supportEmail: dto.supportEmail.trim() || null }
          : {}),
      },
      include: { zones: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.mapClub(updated);
  }

  async uploadClubImage(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Загрузите изображение');
    }
    const ext = extname(file.originalname || '').toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      throw new BadRequestException('Формат: JPG, PNG или WebP');
    }
    const club = await this.prisma.club.findFirst();
    if (!club) throw new NotFoundException('Клуб не найден');

    const filename = `hero${ext}`;
    const rel = join('club', filename);
    const abs = join(this.uploadRoot, filename);
    writeFileSync(abs, file.buffer);

    const updated = await this.prisma.club.update({
      where: { id: club.id },
      data: { imagePath: rel },
      include: { zones: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.mapClub(updated);
  }

  async streamClubImage(res: Response) {
    const club = await this.prisma.club.findFirst();
    if (!club?.imagePath) {
      throw new NotFoundException('Фото клуба не задано');
    }
    const abs = join(process.cwd(), 'uploads', club.imagePath);
    if (!existsSync(abs)) {
      throw new NotFoundException('Файл не найден');
    }
    const ext = extname(abs).toLowerCase();
    const type =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(abs);
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
