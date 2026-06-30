export type PricingDiscountType = 'package' | 'night';

export interface PricingDiscountLine {
  type: PricingDiscountType;
  label: string;
  amountKopecks: number;
}

export interface PriceBreakdown {
  pricePerHour: number;
  durationHours: number;
  nightMinutes: number;
  basePriceKopecks: number;
  discountAmountKopecks: number;
  totalPriceKopecks: number;
  discounts: PricingDiscountLine[];
  packageBadge: string | null;
  packageLabel: string | null;
  recommended: boolean;
}

export interface PresetQuote {
  hours: number;
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  badge: string | null;
  label: string | null;
  recommended: boolean;
}

export interface WindowPackageQuote {
  packageId: string;
  label: string;
  window: string;
  startHour: number;
  hours: number;
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  discountPercent: number;
}

export interface QuoteResponse extends PriceBreakdown {
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  presets: PresetQuote[];
  windowPresets: WindowPackageQuote[];
}
