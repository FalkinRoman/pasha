import { Booking } from '../types';
import { apiFetch } from './client';

export async function fetchActiveBooking() {
  return apiFetch<Booking | null>('/bookings/active', { auth: true });
}

export async function fetchBookingHistory() {
  return apiFetch<Booking[]>('/bookings/history', { auth: true });
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
