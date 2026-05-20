import { api } from './client';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type Dashboard = {
  usersCount: number;
  bookingsToday: number;
  revenueTodayRub: number;
  occupancyPercent: number;
  seatsByStatus: Record<string, number>;
  recentBookings: BookingRow[];
  recentFeedback: FeedbackRow[];
};

export type SeatRow = {
  id: string;
  number: number;
  status: string;
  zoneId: string;
  zoneSlug: string;
  zoneName: string;
  pricePerHour: number;
  specs: string;
};

export type ZoneRow = {
  id: string;
  slug: string;
  name: string;
  specs: string;
  pricePerHour: number;
  seatsCount: number;
};

export type BookingRow = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  totalPriceRub: number;
  createdAt: string;
  userPhone?: string;
  userName?: string;
  seats: { number: number; zoneName?: string }[];
};

export type UserRow = {
  id: string;
  phone: string;
  name: string;
  balanceRub: number;
  bookingsCount: number;
  createdAt: string;
};

export type TransactionRow = {
  id: string;
  type: string;
  amountRub: number;
  description: string | null;
  userPhone: string;
  createdAt: string;
};

export type FeedbackRow = {
  id: string;
  rating: number;
  message: string;
  userPhone: string;
  userName: string;
  createdAt: string;
};

export function login(email: string, password: string) {
  return api<{ accessToken: string; admin: AdminUser }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function forgotPassword(email: string) {
  return api<{ ok: boolean; message: string }>('/admin/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return api<{ ok: boolean; message: string }>('/admin/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export function fetchMe() {
  return api<AdminUser>('/admin/auth/me');
}

export function fetchDashboard() {
  return api<Dashboard>('/admin/dashboard');
}

export type FloorMapData = {
  club: { id: string; name: string; address: string; rating: number };
  zones: {
    id: string;
    name: string;
    specs: string;
    labelX: number;
    labelY: number;
  }[];
  seats: {
    id: string;
    number: number;
    zoneId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    status: string;
  }[];
};

export function fetchFloorMap() {
  return api<FloorMapData>('/club/floor-map');
}

export function fetchSeats() {
  return api<SeatRow[]>('/admin/seats');
}

export function createSeat(data: {
  zoneId: string;
  number: number;
  status?: string;
}) {
  return api('/admin/seats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSeat(
  id: string,
  data: { status?: string; zoneId?: string; number?: number }
) {
  return api(`/admin/seats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteSeat(id: string) {
  return api(`/admin/seats/${id}`, { method: 'DELETE' });
}

export function fetchZones() {
  return api<ZoneRow[]>('/admin/zones');
}

export function createZone(data: {
  slug: string;
  name: string;
  specs?: string;
  pricePerHour: number;
}) {
  return api('/admin/zones', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateZone(
  id: string,
  data: { name?: string; specs?: string; pricePerHour?: number }
) {
  return api(`/admin/zones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteZone(id: string) {
  return api(`/admin/zones/${id}`, { method: 'DELETE' });
}

export function fetchBookings(status?: string) {
  const q = status ? `?status=${status}` : '';
  return api<BookingRow[]>(`/admin/bookings${q}`);
}

export function cancelBooking(id: string) {
  return api(`/admin/bookings/${id}/cancel`, { method: 'POST' });
}

export function fetchUsers(search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return api<UserRow[]>(`/admin/users${q}`);
}

export function fetchUser(id: string) {
  return api<{
    id: string;
    phone: string;
    name: string;
    balanceRub: number;
    bookings: BookingRow[];
    transactions: { id: string; type: string; amountRub: number; description: string | null; createdAt: string }[];
  }>(`/admin/users/${id}`);
}

export function adjustWallet(userId: string, amountKopecks: number, description?: string) {
  return api<{ balanceRub: number }>(`/admin/users/${userId}/wallet/adjust`, {
    method: 'POST',
    body: JSON.stringify({ amountKopecks, description }),
  });
}

export function fetchTransactions() {
  return api<TransactionRow[]>('/admin/transactions');
}

export function fetchFeedback() {
  return api<FeedbackRow[]>('/admin/feedback');
}
