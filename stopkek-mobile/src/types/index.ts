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

export interface Booking {
  id: string;
  seatNumbers: number[];
  zoneName: string;
  startAt: string;
  endAt: string;
  startedAt?: string | null;
  durationMinutes?: number;
  totalPrice: number;
  status: BookingStatus;
  sessionPhase?: SessionPhase;
  doorWindowOpen?: boolean;
  untilStartMs?: number;
  untilEndMs?: number;
  gameRunning?: boolean;
  timerMode?: SessionTimerMode;
  timerLabel?: string;
  displayRemainingMs?: number;
  canOpenMainDoor?: boolean;
  canOpenCell?: boolean;
  needsAcceptance?: boolean;
}
