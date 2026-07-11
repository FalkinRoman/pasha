export const BOOKING_PRESETS = [
  { hours: 1, discountPct: 0 },
  { hours: 3, discountPct: 7 },
  { hours: 6, discountPct: 13 },
  { hours: 8, discountPct: 16 },
] as const;

export const BOOKING_MAX_DAYS_AHEAD = 7;

export const BOOKING_MIN_HOURS = 1;
export const BOOKING_MAX_HOURS = 12;

/** Dev/test only: a 16-minute booking so we can watch notifications / expiry
 *  without waiting an hour. The server refuses sub-hour bookings unless the test
 *  gate (ALLOW_TEST_BOOKINGS=1) is on, so this is safe to ship behind __DEV__. */
export const TEST_BOOKING_HOURS = 16 / 60;

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

export function getTierDiscountForHours(
  hours: number,
  packages?: readonly { minHours: number; discountPercent: number }[]
) {
  if (packages?.length) {
    let discount = 0;
    for (const p of packages) {
      if (hours >= p.minHours) discount = p.discountPercent;
    }
    return discount;
  }
  let discount = 0;
  for (const preset of BOOKING_PRESETS) {
    if (hours >= preset.hours) discount = preset.discountPct;
  }
  return discount;
}

function padHour(h: number) {
  return String(h).padStart(2, '0');
}

export function windowDurationHours(startHour: number, endHour: number) {
  if (endHour > startHour) return endHour - startHour;
  return 24 - startHour + endHour;
}

export function timeWindowPackageLabel(startHour: number): string {
  if (startHour >= 21 || startHour <= 5) return 'Пакет ночь';
  if (startHour >= 6 && startHour <= 12) return 'Пакет утро';
  return 'Пакет день';
}

export function buildTimePackages(
  windows: readonly {
    id: string;
    startHour: number;
    endHour: number;
    discountPercent: number;
    window?: string;
  }[]
): BookingPackage[] {
  if (!windows.length) return [...BOOKING_PACKAGES];
  return windows.map((w) => {
    const hours = windowDurationHours(w.startHour, w.endHour);
    return {
      id: `tw-${w.id}`,
      label: timeWindowPackageLabel(w.startHour),
      window: w.window ?? `${padHour(w.startHour)}:00–${padHour(w.endHour)}:00`,
      startHour: w.startHour,
      hours,
      discountPct: w.discountPercent,
    };
  });
}

/** id NightPricing из activePackageId вида tw-{id} */
export function parseTimeWindowId(activePackageId: string | null | undefined) {
  if (!activePackageId?.startsWith('tw-')) return undefined;
  return activePackageId.slice(3);
}

/** Бейдж −X% только из процента скидки пакета в БД */
export function formatDiscountBadge(discountPct?: number) {
  if (discountPct != null && discountPct > 0) return `−${discountPct}%`;
  return null;
}

/** Скидка для кнопки N ч — только пакет с minHours === N (1 ч без пакета = 0) */
export function getPresetPackageDiscount(
  hours: number,
  packages: readonly { minHours: number; discountPercent: number }[]
) {
  return packages.find((p) => p.minHours === hours)?.discountPercent ?? 0;
}

/** Часы для кнопок «Сколько играть»: 1 ч + пакеты из админки. */
export function buildDurationPresetHours(
  packages: readonly { minHours: number }[]
): number[] {
  const hours = new Set<number>([1]);
  for (const p of packages) hours.add(p.minHours);
  return [...hours].sort((a, b) => a - b);
}

export function getBookingSummaryPricing(
  pricePerHour: number,
  durationHours: number,
  activePackageId: string | null,
  timePackages: readonly BookingPackage[] = BOOKING_PACKAGES,
  durationPackages?: readonly { minHours: number; discountPercent: number }[]
) {
  const pkg = timePackages.find((p) => p.id === activePackageId) ?? null;
  if (pkg) return { pkg, ...calcBookingPrice(pricePerHour, pkg.hours, pkg.discountPct) };
  return {
    pkg: null as BookingPackage | null,
    ...calcBookingPrice(
      pricePerHour,
      durationHours,
      getTierDiscountForHours(durationHours, durationPackages)
    ),
  };
}

export function resolveBookingStartDate(
  pickedDate: Date,
  activePackageId: string | null,
  timePackages: readonly BookingPackage[] = BOOKING_PACKAGES,
  now = new Date()
) {
  const pkg = timePackages.find((p) => p.id === activePackageId);
  if (!pkg) return pickedDate;
  const d = new Date(pickedDate);
  d.setHours(pkg.startHour, 0, 0, 0);
  if (d < now) d.setDate(d.getDate() + 1);
  return d;
}
