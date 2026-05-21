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

export async function submitSessionAcceptance(
  bookingId: string,
  items: Record<string, boolean>,
  hasIssue: boolean,
  comment?: string
) {
  return apiFetch<Booking>(`/bookings/${bookingId}/acceptance`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ items, hasIssue, comment }),
  });
}

export async function startSessionCheckout(bookingId: string) {
  return apiFetch<Booking>(`/bookings/${bookingId}/checkout/start`, {
    method: 'POST',
    auth: true,
  });
}

export async function extendBooking(bookingId: string, hours: number) {
  return apiFetch<Booking>(`/bookings/${bookingId}/extend`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ hours }),
  });
}

async function uploadBookingMultipart(
  path: string,
  uri: string,
  fields: Record<string, string>
) {
  const { API_URL } = await import('../config/api');
  const { getAccessToken } = await import('./client');
  const { uploadAsync, FileSystemUploadType } = await import('expo-file-system/legacy');
  const token = getAccessToken();
  if (!token) throw new Error('Не авторизован');

  const res = await uploadAsync(`${API_URL}${path}`, uri, {
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'photo',
    httpMethod: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    parameters: fields,
  });

  if (res.status < 200 || res.status >= 300) {
    let msg = 'Ошибка загрузки';
    try {
      const data = JSON.parse(res.body);
      if (data?.message) msg = String(data.message);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return JSON.parse(res.body) as Booking;
}

export async function submitSessionAcceptanceWithPhoto(
  bookingId: string,
  items: Record<string, boolean>,
  hasIssue: boolean,
  comment: string | undefined,
  photoUri?: string
) {
  const fields: Record<string, string> = {
    items: JSON.stringify(items),
    hasIssue: hasIssue ? 'true' : 'false',
  };
  if (comment) fields.comment = comment;
  if (photoUri) {
    return uploadBookingMultipart(`/bookings/${bookingId}/acceptance`, photoUri, fields);
  }
  return apiFetch<Booking>(`/bookings/${bookingId}/acceptance`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ items, hasIssue, comment }),
  });
}

export async function uploadCheckoutPhoto(bookingId: string, photoUri: string) {
  return uploadBookingMultipart(`/bookings/${bookingId}/checkout/photo`, photoUri, {});
}

export async function completeSessionCheckout(bookingId: string, photoUri?: string) {
  if (photoUri) {
    const uploaded = await uploadCheckoutPhoto(bookingId, photoUri);
    void uploaded;
  }
  return apiFetch<{ ok: boolean; refundRub: number; balanceRub: number }>(
    `/bookings/${bookingId}/checkout/complete`,
    { method: 'POST', auth: true }
  );
}
