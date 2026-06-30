import { Injectable } from '@nestjs/common';
import { DurationPackage, NightPricing } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PresetQuote,
  PriceBreakdown,
  PricingDiscountLine,
  QuoteResponse,
  WindowPackageQuote,
} from './pricing.types';

const SLOT_MS = 30 * 60_000;

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
    const [packages, timeWindows] = await Promise.all([
      this.loadPackages(clubId, zoneId),
      this.loadTimeWindows(clubId, zoneId),
    ]);
    const breakdown = this.calculate(pricePerHour, durationHours, startAt, packages, timeWindows);
    const presetHours = this.buildPresetHours(packages);
    const presets = presetHours.map((h) => {
      const p = this.calculate(pricePerHour, h, startAt, packages, timeWindows);
      const pkg = this.pickPackage(packages, h);
      return {
        hours: h,
        basePriceRub: Math.round(p.basePriceKopecks / 100),
        totalPriceRub: Math.round(p.totalPriceKopecks / 100),
        discountRub: Math.round(p.discountAmountKopecks / 100),
        badge: pkg?.badge ?? p.packageBadge,
        label: pkg?.label ?? null,
        recommended: pkg?.recommended ?? false,
      } satisfies PresetQuote;
    });
    const windowPresets = this.buildWindowPresets(
      pricePerHour,
      startAt,
      packages,
      timeWindows
    );
    return {
      ...breakdown,
      basePriceRub: Math.round(breakdown.basePriceKopecks / 100),
      totalPriceRub: Math.round(breakdown.totalPriceKopecks / 100),
      discountRub: Math.round(breakdown.discountAmountKopecks / 100),
      presets,
      windowPresets,
    };
  }

  private buildPresetHours(packages: DurationPackage[]): number[] {
    const hours = new Set<number>([1]);
    for (const p of packages) {
      if (p.active) hours.add(p.minHours);
    }
    return [...hours].sort((a, b) => a - b);
  }

  private windowDurationHours(startHour: number, endHour: number) {
    if (endHour > startHour) return endHour - startHour;
    return 24 - startHour + endHour;
  }

  private resolveWindowStart(reference: Date, startHour: number, now = new Date()) {
    const d = new Date(reference);
    d.setHours(startHour, 0, 0, 0);
    d.setSeconds(0, 0);
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }

  private buildWindowPresets(
    pricePerHour: number,
    referenceStart: Date,
    packages: DurationPackage[],
    timeWindows: NightPricing[]
  ): WindowPackageQuote[] {
    const pad = (n: number) => String(n).padStart(2, '0');
    return timeWindows
      .filter((w) => w.active)
      .map((win) => {
        const hours = this.windowDurationHours(win.startHour, win.endHour);
        const pkgStart = this.resolveWindowStart(referenceStart, win.startHour);
        const q = this.calculate(pricePerHour, hours, pkgStart, packages, timeWindows);
        return {
          packageId: `tw-${win.id}`,
          label: this.timeWindowPackageLabel(win.startHour),
          window: `${pad(win.startHour)}:00–${pad(win.endHour)}:00`,
          startHour: win.startHour,
          hours,
          basePriceRub: Math.round(q.basePriceKopecks / 100),
          totalPriceRub: Math.round(q.totalPriceKopecks / 100),
          discountRub: Math.round(q.discountAmountKopecks / 100),
          discountPercent: win.discountPercent,
        } satisfies WindowPackageQuote;
      });
  }

  private timeWindowPackageLabel(startHour: number): string {
    if (startHour >= 21 || startHour <= 5) return 'Пакет ночь';
    if (startHour >= 6 && startHour <= 12) return 'Пакет утро';
    return 'Пакет день';
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

  /** Поминутное продление: только пропорция от pricePerHour, без пакетов и окон. */
  quoteExtensionMinutes(pricePerHour: number, minutes: number): PriceBreakdown {
    const durationHours = minutes / 60;
    const basePriceKopecks = Math.round(pricePerHour * durationHours * 100);
    return {
      pricePerHour,
      durationHours,
      nightMinutes: 0,
      basePriceKopecks,
      discountAmountKopecks: 0,
      totalPriceKopecks: basePriceKopecks,
      discounts: [],
      packageBadge: null,
      packageLabel: null,
      recommended: false,
    };
  }

  packageDiscountKopecks(breakdown: PriceBreakdown): number {
    return breakdown.discounts
      .filter((d) => d.type === 'package')
      .reduce((sum, d) => sum + d.amountKopecks, 0);
  }

  calculate(
    pricePerHour: number,
    durationHours: number,
    startAt: Date,
    packages: DurationPackage[],
    timeWindows: NightPricing[]
  ): PriceBreakdown {
    const durationMinutes = Math.round(durationHours * 60);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    const basePriceKopecks = Math.round(pricePerHour * durationHours * 100);

    const pkg = this.pickPackage(packages, durationHours);
    let packageDiscount = 0;
    if (pkg && pkg.discountPercent > 0) {
      packageDiscount = Math.round((basePriceKopecks * pkg.discountPercent) / 100);
    }

    const discounts: PricingDiscountLine[] = [];
    if (packageDiscount > 0 && pkg) {
      discounts.push({ type: 'package', label: pkg.label, amountKopecks: packageDiscount });
    }

    let totalWindowMinutes = 0;
    let totalWindowDiscount = 0;
    for (const win of timeWindows) {
      if (!win.active || win.discountPercent <= 0) continue;
      const mins = this.countNightMinutes(startAt, endAt, win.startHour, win.endHour);
      if (mins <= 0) continue;
      const discount = Math.round((mins / 60) * pricePerHour * 100 * (win.discountPercent / 100));
      totalWindowMinutes += mins;
      totalWindowDiscount += discount;
      const h = Math.round((mins / 60) * 10) / 10;
      discounts.push({
        type: 'night',
        label: `${this.timeWindowLabel(win.startHour)} (${this.formatNightWindow(win.startHour, win.endHour)}, ${h} ч)`,
        amountKopecks: discount,
      });
    }

    const discountAmountKopecks = packageDiscount + totalWindowDiscount;
    const totalPriceKopecks = Math.max(0, basePriceKopecks - discountAmountKopecks);

    return {
      pricePerHour,
      durationHours,
      nightMinutes: totalWindowMinutes,
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

  private async loadTimeWindows(clubId: string, zoneId: string): Promise<NightPricing[]> {
    const zoned = await this.prisma.nightPricing.findMany({
      where: { clubId, zoneId, active: true },
    });
    if (zoned.length) return zoned;
    return this.prisma.nightPricing.findMany({
      where: { clubId, zoneId: null, active: true },
    });
  }

  private timeWindowLabel(startHour: number): string {
    if (startHour >= 21 || startHour <= 5) return 'Ночной тариф';
    if (startHour >= 6 && startHour <= 12) return 'Утренний тариф';
    return 'Дневной тариф';
  }
}
