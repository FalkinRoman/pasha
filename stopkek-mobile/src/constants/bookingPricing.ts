export const BOOKING_PRESETS = [
  { hours: 1, discountPct: 0 },
  { hours: 3, discountPct: 7 },
  { hours: 6, discountPct: 13 },
  { hours: 8, discountPct: 16 },
] as const;

export const BOOKING_MAX_DAYS_AHEAD = 7;

export const BOOKING_MIN_HOURS = 1;
export const BOOKING_MAX_HOURS = 12;

export const BOOKING_PACKAGES = [
  { id: 'night', label: 'Пакет ночь', window: '23:00–08:00', startHour: 23, hours: 9, discountPct: 36 },
  { id: 'morning', label: 'Пакет утро', window: '10:00–16:00', startHour: 10, hours: 6, discountPct: 26 },
] as const;

export type BookingPackage = (typeof BOOKING_PACKAGES)[number];

export function calcBookingPrice(pricePerHour: number, hours: number, discountPct: number) {
  const original = pricePerHour * hours;
  const discounted = Math.round(original * (1 - discountPct / 100));
  return {
    original,
    discounted,
    discount: original - discounted,
    hasDiscount: discountPct > 0,
  };
}

export function getTierDiscountForHours(hours: number) {
  let discount = 0;
  for (const preset of BOOKING_PRESETS) {
    if (hours >= preset.hours) discount = preset.discountPct;
  }
  return discount;
}

export function getBookingSummaryPricing(
  pricePerHour: number,
  durationHours: number,
  activePackageId: string | null
) {
  const pkg = BOOKING_PACKAGES.find((p) => p.id === activePackageId) ?? null;
  if (pkg) return { pkg, ...calcBookingPrice(pricePerHour, pkg.hours, pkg.discountPct) };
  return {
    pkg: null as BookingPackage | null,
    ...calcBookingPrice(pricePerHour, durationHours, getTierDiscountForHours(durationHours)),
  };
}

export function resolveBookingStartDate(
  pickedDate: Date,
  activePackageId: string | null,
  now = new Date()
) {
  const pkg = BOOKING_PACKAGES.find((p) => p.id === activePackageId);
  if (!pkg) return pickedDate;
  const d = new Date(pickedDate);
  d.setHours(pkg.startHour, 0, 0, 0);
  if (d < now) d.setDate(d.getDate() + 1);
  return d;
}
