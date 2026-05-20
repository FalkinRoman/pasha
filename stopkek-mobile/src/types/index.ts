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

export interface User {
  id: string;
  phone: string;
  name: string;
  balance: number;
  profileCompleted?: boolean;
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
  | 'cancelled';

export interface Booking {
  id: string;
  seatNumbers: number[];
  zoneName: string;
  startAt: string;
  endAt: string;
  totalPrice: number;
  status: BookingStatus;
}
