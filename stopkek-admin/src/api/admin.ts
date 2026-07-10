import { API_URL, api, getToken } from './client';

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
  pendingVerifications?: number;
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
  lockId?: string | null;
  cellLock?: string | null;
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
  sessionPhase?: string | null;
  startAt: string;
  endAt: string;
  totalPriceRub: number;
  createdAt: string;
  userPhone?: string;
  userName?: string;
  seats: { number: number; zoneName?: string }[];
};

export type UserVerification = {
  id: string;
  status: string;
  submittedAt: string;
  resolvedAt: string | null;
  rejectReason: string | null;
  photoUrl: string;
};

export type UserRow = {
  id: string;
  phone: string;
  name: string;
  balanceRub: number;
  bookingsCount: number;
  createdAt: string;
  identityStatus: string;
  identityVerified: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
};

export type UserDetail = {
  id: string;
  phone: string;
  name: string;
  balanceRub: number;
  identityStatus: string;
  identityVerified: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  verification: UserVerification | null;
  bookings: BookingRow[];
  transactions: {
    id: string;
    type: string;
    amountRub: number;
    description: string | null;
    createdAt: string;
  }[];
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
  data: {
    status?: string;
    zoneId?: string;
    number?: number;
    lockId?: string;
    cellLock?: string;
  }
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
  return api<UserDetail>(`/admin/users/${id}`);
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

export type VerificationRow = {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  status: string;
  submittedAt: string;
  autoApproveAt: string;
  secondsUntilAutoApprove: number;
  photoUrl: string;
};

export function fetchVerifications() {
  return api<VerificationRow[]>('/admin/verifications');
}

export function approveVerification(id: string) {
  return api(`/admin/verifications/${id}/approve`, { method: 'POST' });
}

export function rejectVerification(id: string, reason: string) {
  return api(`/admin/verifications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export type ClubSettings = {
  id: string;
  name: string;
  address: string;
  rating: number;
  hours: string;
  imageUrl: string | null;
  supportPhone: string | null;
  supportTelegram: string | null;
  supportEmail: string | null;
};

export function fetchClubSettings() {
  return api<ClubSettings>('/admin/club');
}

export function updateClubSettings(data: Partial<ClubSettings>) {
  return api<ClubSettings>('/admin/club', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function uploadClubImage(file: File) {
  const form = new FormData();
  form.append('image', file);
  const token = getToken();
  return fetch(`${API_URL}/admin/club/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (res) => {
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const msg =
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message: string | string[] }).message)
          : res.statusText;
      throw new Error(Array.isArray(msg) ? msg[0] : msg);
    }
    return data as ClubSettings;
  });
}

export function clubImageSrc(imageUrl: string | null) {
  if (!imageUrl) return null;
  return `${API_URL}${imageUrl}`;
}

export type AdminLoginCode = {
  phone: string;
  code: string;
  expiresInSec: number;
};

export function generateUserLoginCode(userId: string) {
  return api<AdminLoginCode>(`/admin/users/${userId}/login-code`, { method: 'POST' });
}

export type AcceptanceReportRow = {
  id: string;
  bookingId: string;
  comment: string;
  items: Record<string, boolean>;
  hasIssue: boolean;
  resolved: boolean;
  createdAt: string;
  seatNumber: number;
  userPhone: string;
  userName: string;
};

export function fetchAcceptanceReports(resolved = false) {
  return api<AcceptanceReportRow[]>(
    `/admin/acceptance-reports?resolved=${resolved ? 'true' : 'false'}`
  );
}

export function resolveAcceptanceReport(id: string) {
  return api(`/admin/acceptance-reports/${id}/resolve`, { method: 'POST' });
}

export type ClubLocks = {
  lockProvider: 'mock' | 'http' | 'mqtt';
  mainDoorLockId: string | null;
  lockHttpBaseUrl: string | null;
  lockHttpToken: string | null;
  lockMqttTopic: string | null;
};

export function fetchClubLocks() {
  return api<ClubLocks>('/admin/club/locks');
}

export function updateClubLocks(data: Partial<ClubLocks>) {
  return api<ClubLocks>('/admin/club/locks', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export type ClubPayments = {
  yookassaEnabled: boolean;
  mockTopupEnabled: boolean;
  yookassaConfigured: boolean;
  effectiveYookassaEnabled: boolean;
  effectiveMockTopupEnabled: boolean;
};

export function fetchClubPayments() {
  return api<ClubPayments>('/admin/club/payments');
}

export function updateClubPayments(data: Pick<ClubPayments, 'yookassaEnabled' | 'mockTopupEnabled'>) {
  return api<ClubPayments>('/admin/club/payments', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export type LockEventRow = {
  id: string;
  lockType: string;
  lockTarget: string;
  provider: string;
  success: boolean;
  error: string | null;
  createdAt: string;
};

export function fetchLockEvents() {
  return api<LockEventRow[]>('/admin/locks/events');
}

export type LockerLogRow = {
  id: string;
  type: string;
  bookingId: string | null;
  seatNumber: number;
  cellLock: string;
  hasPhoto: boolean;
  createdAt: string;
  userId: string;
  userPhone: string;
  userName: string;
  bookingStatus: string | null;
  bookingPhase: string | null;
  bookingStartAt: string | null;
  bookingEndAt: string | null;
  bookingTotalRub: number | null;
  lockOk: boolean | null;
};

export function fetchAccessLogs(params?: {
  seatNumber?: number;
  cellLock?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.seatNumber != null) q.set('seatNumber', String(params.seatNumber));
  if (params?.cellLock) q.set('cellLock', params.cellLock);
  if (params?.limit != null) q.set('limit', String(params.limit));
  const suffix = q.toString() ? `?${q}` : '';
  return api<LockerLogRow[]>(`/admin/access-logs${suffix}`);
}

/** @deprecated */
export const fetchCellControl = fetchAccessLogs;

export function purgeLegacyAccessLogs() {
  return api<{
    ok: boolean;
    removedLegacy: number;
    removedLockEvents: number;
  }>('/admin/access-logs/purge-legacy', { method: 'POST' });
}

export function lockerLogPhotoPath(logId: string) {
  return `/admin/cell-control/${logId}/photo`;
}

export type DurationPackageRow = {
  id: string;
  zoneId: string | null;
  minHours: number;
  discountPercent: number;
  label: string;
  badge: string | null;
  recommended: boolean;
  sortOrder: number;
  active: boolean;
};

export type NightPricingRow = {
  id: string;
  zoneId: string | null;
  startHour: number;
  endHour: number;
  discountPercent: number;
  active: boolean;
};

export type PricingData = {
  packages: DurationPackageRow[];
  nightRules: NightPricingRow[];
  zones: { id: string; name: string; slug: string; pricePerHour: number }[];
};

export function fetchPricing() {
  return api<PricingData>('/admin/pricing');
}

export function createDurationPackage(body: {
  zoneId?: string | null;
  minHours: number;
  discountPercent: number;
  label: string;
  badge?: string | null;
  recommended?: boolean;
  sortOrder?: number;
  active?: boolean;
}) {
  return api<DurationPackageRow>('/admin/pricing/packages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDurationPackage(
  id: string,
  body: {
    zoneId?: string | null;
    minHours: number;
    discountPercent: number;
    label: string;
    badge?: string | null;
    recommended?: boolean;
    sortOrder?: number;
    active?: boolean;
  }
) {
  return api<DurationPackageRow>(`/admin/pricing/packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteDurationPackage(id: string) {
  return api<{ ok: boolean }>(`/admin/pricing/packages/${id}`, { method: 'DELETE' });
}

export function createNightPricing(body: {
  zoneId?: string | null;
  startHour: number;
  endHour: number;
  discountPercent: number;
  active?: boolean;
}) {
  return api<NightPricingRow>('/admin/pricing/night', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateNightPricing(
  id: string,
  body: {
    zoneId?: string | null;
    startHour: number;
    endHour: number;
    discountPercent: number;
    active?: boolean;
  }
) {
  return api<NightPricingRow>(`/admin/pricing/night/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function upsertNightPricing(body: {
  zoneId?: string | null;
  startHour: number;
  endHour: number;
  discountPercent: number;
  active?: boolean;
}) {
  return api<NightPricingRow>('/admin/pricing/night', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteNightPricing(id: string) {
  return api<{ ok: boolean }>(`/admin/pricing/night/${id}`, { method: 'DELETE' });
}
