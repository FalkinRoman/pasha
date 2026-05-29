import { Injectable } from '@nestjs/common';
import { DurationPackage, NightPricing } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PresetQuote,
  PriceBreakdown,
  PricingDiscountLine,
  QuoteResponse,
} from './pricing.types';

const SLOT_MS = 30 * 60_000;
const PRESET_HOURS = [1, 2, 3, 4, 6, 8];

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quoteForSeat(
    zoneId: string,
    clubId: string,
    pricePerHour: number,
    durationHours: number,
    startAt: Date
  ): Promise<QuoteResponse> {
    const [packages, night] = await Promise.all([
      this.loadPackages(clubId, zoneId),
      this.loadNight(clubId, zoneId),
    ]);
    const breakdown = this.calculate(
      pricePerHour,
      durationHours,
      startAt,
      packages,
      night
    );
    const presets = PRESET_HOURS.map((h) => {
      const p = this.calculate(pricePerHour, h, startAt, packages, night);
      return {
        hours: h,
        basePriceRub: Math.round(p.basePriceKopecks / 100),
        totalPriceRub: Math.round(p.totalPriceKopecks / 100),
        discountRub: Math.round(p.discountAmountKopecks / 100),
        badge: p.packageBadge,
        recommended: p.recommended,
      } satisfies PresetQuote;
    });
    return {
      ...breakdown,
      basePriceRub: Math.round(breakdown.basePriceKopecks / 100),
      totalPriceRub: Math.round(breakdown.totalPriceKopecks / 100),
      discountRub: Math.round(breakdown.discountAmountKopecks / 100),
      presets,
    };
  }

  async quoteForZone(
    zoneId: string,
    durationHours: number,
    startAtIso?: string
  ): Promise<QuoteResponse> {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: { club: true },
    });
    if (!zone) throw new Error('Zone not found');
    const startAt = startAtIso ? new Date(startAtIso) : new Date();
    return this.quoteForSeat(zone.id, zone.clubId, zone.pricePerHour, durationHours, startAt);
  }

  calculate(
    pricePerHour: number,
    durationHours: number,
    startAt: Date,
    packages: DurationPackage[],
    night: NightPricing | null
  ): PriceBreakdown {
    const durationMinutes = Math.round(durationHours * 60);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const basePriceKopecks = Math.round(pricePerHour * durationHours * 100);

    const pkg = this.pickPackage(packages, durationHours);
    let packageDiscount = 0;
    if (pkg && pkg.discountPercent > 0) {
      packageDiscount = Math.round((basePriceKopecks * pkg.discountPercent) / 100);
    }

    const nightMinutes = night?.active
      ? this.countNightMinutes(startAt, endAt, night.startHour, night.endHour)
      : 0;
    let nightDiscount = 0;
    if (night?.active && night.discountPercent > 0 && nightMinutes > 0) {
      nightDiscount = Math.round(
        (nightMinutes / 60) * pricePerHour * 100 * (night.discountPercent / 100)
      );
    }

    const discounts: PricingDiscountLine[] = [];
    if (packageDiscount > 0 && pkg) {
      discounts.push({
        type: 'package',
        label: pkg.label,
        amountKopecks: packageDiscount,
      });
    }
    if (nightDiscount > 0 && night) {
      const nightH = Math.round((nightMinutes / 60) * 10) / 10;
      discounts.push({
        type: 'night',
        label: `Ночной тариф (${this.formatNightWindow(night.startHour, night.endHour)}, ${nightH} ч)`,
        amountKopecks: nightDiscount,
      });
    }

    const discountAmountKopecks = packageDiscount + nightDiscount;
    const totalPriceKopecks = Math.max(0, basePriceKopecks - discountAmountKopecks);

    return {
      pricePerHour,
      durationHours,
      nightMinutes,
      basePriceKopecks,
      discountAmountKopecks,
      totalPriceKopecks,
      discounts,
      packageBadge: pkg?.badge ?? null,
      packageLabel: pkg?.label ?? null,
      recommended: pkg?.recommended ?? false,
    };
  }

  private pickPackage(packages: DurationPackage[], durationHours: number) {
    const active = packages.filter((p) => p.active && durationHours >= p.minHours);
    if (!active.length) return null;
    return active.sort((a, b) => b.minHours - a.minHours)[0];
  }

  private countNightMinutes(
    startAt: Date,
    endAt: Date,
    startHour: number,
    endHour: number
  ): number {
    let night = 0;
    for (let t = startAt.getTime(); t < endAt.getTime(); t += SLOT_MS) {
      const d = new Date(t);
      if (this.isNightHour(d.getHours(), startHour, endHour)) {
        const slotEnd = Math.min(t + SLOT_MS, endAt.getTime());
        night += (slotEnd - t) / 60_000;
      }
    }
    return night;
  }

  private isNightHour(hour: number, startHour: number, endHour: number): boolean {
    if (startHour > endHour) {
      return hour >= startHour || hour < endHour;
    }
    return hour >= startHour && hour < endHour;
  }

  private formatNightWindow(startHour: number, endHour: number): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(startHour)}:00–${pad(endHour)}:00`;
  }

  private async loadPackages(clubId: string, zoneId: string) {
    const all = await this.prisma.durationPackage.findMany({
      where: {
        clubId,
        active: true,
        OR: [{ zoneId: null }, { zoneId }],
      },
      orderBy: [{ sortOrder: 'asc' }, { minHours: 'asc' }],
    });
    const global = all.filter((p) => !p.zoneId);
    const zoned = all.filter((p) => p.zoneId === zoneId);
    return zoned.length ? zoned : global;
  }

  private async loadNight(clubId: string, zoneId: string) {
    const zoned = await this.prisma.nightPricing.findFirst({
      where: { clubId, zoneId, active: true },
    });
    if (zoned) return zoned;
    return this.prisma.nightPricing.findFirst({
      where: { clubId, zoneId: null, active: true },
    });
  }
}
