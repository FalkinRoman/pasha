import { Booking, BookingPriceQuote, ExtendQuote } from '../types';
import { apiFetch } from './client';

export async function quoteBooking(
  seatId: string,
  durationHours: number,
  startAt?: string
) {
  return apiFetch<BookingPriceQuote>('/bookings/quote', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ seatId, durationHours, startAt }),
  });
}

export async function fetchActiveBooking() {
  return apiFetch<Booking | null>('/bookings/active', { auth: true });
}

export async function fetchBookingHistory() {
  return apiFetch<Booking[]>('/bookings/history', { auth: true });
}

export async function fetchBookingById(bookingId: string) {
  return apiFetch<Booking>(`/bookings/${bookingId}`, { auth: true });
}

export async function createBooking(
  seatId: string,
  durationHours: number,
  startAt?: string
) {
  return apiFetch<Booking>('/bookings', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ seatId, durationHours, startAt }),
  });
}

export async function payBooking(bookingId: string) {
  return apiFetch<Booking>(`/bookings/${bookingId}/pay`, {
    method: 'POST',
    auth: true,
  });
}

export async function cancelBooking(bookingId: string) {
  return apiFetch<{ ok: boolean }>(`/bookings/${bookingId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function openSessionDoor(bookingId: string) {
  return apiFetch<Booking>(`/bookings/${bookingId}/door`, {
    method: 'POST',
    auth: true,
  });
}

export async function quoteExtend(bookingId: string) {
  return apiFetch<ExtendQuote>(`/bookings/${bookingId}/extend-quote`, {
    method: 'POST',
    auth: true,
  });
}

export async function extendBooking(
  bookingId: string,
  opts: { hours?: number; minutes?: number }
) {
  return apiFetch<Booking>(`/bookings/${bookingId}/extend`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(opts),
  });
}

export async function endSession(bookingId: string) {
  return apiFetch<{ ok: boolean; refundRub: number; balanceRub: number }>(
    `/bookings/${bookingId}/end`,
    { method: 'POST', auth: true }
  );
}

export type PcUnlockCode = {
  code: string;
  seatNumber: number;
  expiresInSec: number;
  qrPayload: string;
  userName: string;
};

export async function fetchPcUnlockCode(bookingId: string) {
  return apiFetch<PcUnlockCode>(`/kiosk/bookings/${bookingId}/pc-code`, {
    method: 'POST',
    auth: true,
  });
}

export async function confirmPcQr(bookingId: string, challengeId: string) {
  return apiFetch<{ ok: boolean; seatNumber: number }>(
    `/kiosk/bookings/${bookingId}/confirm-qr`,
    {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ challengeId }),
    }
  );
}
