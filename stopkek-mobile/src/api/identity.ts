import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { apiFetch } from './client';

export type IdentityStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'auto_approved';

export type IdentityStatusResponse = {
  status: IdentityStatus;
  canBook: boolean;
  rejectReason: string | null;
  submittedAt: string | null;
  autoApproveAt: string | null;
  secondsUntilAutoApprove: number | null;
  verificationId: string | null;
};

function parseApiMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data === 'object' && data && 'message' in data) {
    const msg = (data as { message: string | string[] }).message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export function fetchIdentityStatus() {
  return apiFetch<IdentityStatusResponse>('/identity/status', { auth: true });
}

/** Multipart через expo-file-system — fetch+FormData на iOS часто шлёт пустой файл */
export async function submitIdentityPhoto(uri: string) {
  const { API_URL } = await import('../config/api');
  const { getAccessToken } = await import('./client');
  const token = getAccessToken();
  if (!token) {
    throw new Error('Сессия истекла. Войдите снова.');
  }

  const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;

  const result = await uploadAsync(`${API_URL}/identity/submit`, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'photo',
    mimeType: 'image/jpeg',
    parameters: { pdConsent: 'true' },
    headers: { Authorization: `Bearer ${token}` },
  });

  let data: unknown = null;
  if (result.body) {
    try {
      data = JSON.parse(result.body);
    } catch {
      data = result.body;
    }
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      parseApiMessage(data, `Не удалось отправить (${result.status})`)
    );
  }

  return data as {
    verificationId: string;
    status: 'pending';
    autoApproveAt: string;
    secondsUntilAutoApprove: number;
  };
}
