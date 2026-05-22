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

export async function openSessionDoor(bookingId: string, type: 'main' | 'cell') {
  return apiFetch<Booking>(`/bookings/${bookingId}/door`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ type }),
  });
}

export async function extendBooking(bookingId: string, hours: number) {
  return apiFetch<Booking>(`/bookings/${bookingId}/extend`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ hours }),
  });
}

export async function endSession(bookingId: string) {
  return apiFetch<{ ok: boolean; refundRub: number; balanceRub: number }>(
    `/bookings/${bookingId}/end`,
    { method: 'POST', auth: true }
  );
}
