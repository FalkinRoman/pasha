export type SeatStatus = 'free' | 'occupied' | 'reserved' | 'repair';

export interface Seat {
  id: string;
  number: number;
  zoneId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: SeatStatus;
  bookedFrom?: string;
  bookedUntil?: string;
}

export interface Zone {
  id: string;
  name: string;
  specs: string;
  pricePerHour: number;
  labelX: number;
  labelY: number;
}

export type IdentityStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'auto_approved';

export interface User {
  id: string;
  phone: string;
  name: string;
  balance: number;
  profileCompleted?: boolean;
  identityStatus?: IdentityStatus;
  identityVerified?: boolean;
}

export interface ClubSummary {
  name: string;
  address: string;
  rating: number;
  hours: string;
}

export type BookingStatus =
  | 'draft'
  | 'pending_payment'
  | 'paid'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type SessionTimerMode =
  | 'until_door'
  | 'until_start'
  | 'pre_play'
  | 'playing'
  | 'paused'
  | 'until_end';

export type SessionPhase =
  | 'awaiting_arrival'
  | 'arrival'
  | 'cell_pending'
  | 'acceptance'
  | 'issue'
  | 'playing'
  | 'checkout';

export interface PriceDiscountLine {
  type: 'package' | 'night';
  label: string;
  amountKopecks: number;
}

export interface PresetQuote {
  hours: number;
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  discountPercent: number;
  label?: string | null;
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

export interface ExtendMinuteQuote {
  minutes: number;
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
}

export interface ExtendHourQuote {
  hours: number;
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  discountPercent: number;
  label?: string | null;
}

export interface ExtendPackageQuote {
  packageId: string;
  label: string;
  window: string;
  hours: number;
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  discountPercent: number;
}

export interface ExtendQuote {
  minutePresets: ExtendMinuteQuote[];
  hourPresets: ExtendHourQuote[];
  packagePresets: ExtendPackageQuote[];
  pricePerHour: number;
}

export interface BookingPriceQuote {
  basePriceRub: number;
  totalPriceRub: number;
  discountRub: number;
  nightMinutes: number;
  discounts: PriceDiscountLine[];
  packageBadge: string | null;
  packageLabel: string | null;
  recommended: boolean;
  presets: PresetQuote[];
  windowPresets?: WindowPackageQuote[];
}

export interface Booking {
  id: string;
  seatNumbers: number[];
  zoneName: string;
  startAt: string;
  endAt: string;
  startedAt?: string | null;
  durationMinutes?: number;
  totalPrice: number;
  basePriceRub?: number;
  discountRub?: number;
  status: BookingStatus;
  sessionPhase?: SessionPhase;
  doorWindowOpen?: boolean;
  doorOpensInMs?: number;
  doorHint?: string | null;
  untilStartMs?: number;
  untilEndMs?: number;
  gameRunning?: boolean;
  timerMode?: SessionTimerMode;
  timerLabel?: string;
  displayRemainingMs?: number;
  canOpenMainDoor?: boolean;
  /** После POST /door — без mock/real, для юзера всегда одинаково */
  lockCommandSent?: boolean;
  lockType?: 'main';
  lockPulseSeconds?: number;
  lockCooldownSeconds?: number;
  lockMessage?: string;
}
