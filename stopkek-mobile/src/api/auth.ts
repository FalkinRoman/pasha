import { User } from '../types';
import { apiFetch } from './client';

export type CallRequestResponse = {
  sessionId: string;
  phone: string;
  expiresInSec: number;
  retryAfterSec: number;
  devCode?: string;
};

type AuthUserPayload = {
  id: string;
  phone: string;
  name: string;
  balance: number;
  profileCompleted?: boolean;
  identityStatus?: string;
  identityVerified?: boolean;
};

type LoginResponse = {
  status: 'confirmed';
  isNew: boolean;
  needsProfileSetup: boolean;
  user: AuthUserPayload;
  accessToken: string;
  refreshToken: string;
};

function mapUser(d: AuthUserPayload & { balanceRub?: number }): User {
  return {
    id: d.id,
    phone: d.phone,
    name: d.name,
    balance: d.balanceRub ?? Math.round(d.balance / 100),
    profileCompleted: d.profileCompleted ?? true,
    identityStatus: d.identityStatus as User['identityStatus'],
    identityVerified: d.identityVerified ?? false,
  };
}

export async function requestCall(phone: string) {
  return apiFetch<CallRequestResponse>('/auth/call/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyCall(phone: string, sessionId: string, code: string) {
  const data = await apiFetch<LoginResponse>('/auth/call/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, sessionId, code }),
  });
  return {
    user: mapUser(data.user),
    accessToken: data.accessToken,
    needsProfileSetup: data.needsProfileSetup,
  };
}

export async function requestSms(phone: string) {
  return apiFetch<CallRequestResponse>('/auth/sms/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifySms(phone: string, sessionId: string, code: string) {
  const data = await apiFetch<LoginResponse>('/auth/sms/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, sessionId, code }),
  });
  return {
    user: mapUser(data.user),
    accessToken: data.accessToken,
    needsProfileSetup: data.needsProfileSetup,
  };
}
