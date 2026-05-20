import { User } from '../types';
import { apiFetch } from './client';

type MeResponse = {
  id: string;
  phone: string;
  name: string;
  balance: number;
  balanceRub?: number;
  profileCompleted: boolean;
};

function mapUser(d: MeResponse): User {
  return {
    id: d.id,
    phone: d.phone,
    name: d.name,
    balance: d.balanceRub ?? Math.round(d.balance / 100),
    profileCompleted: d.profileCompleted,
  };
}

export async function fetchMe() {
  const data = await apiFetch<MeResponse>('/users/me', { auth: true });
  return mapUser(data);
}

export async function updateProfile(name: string) {
  const data = await apiFetch<MeResponse>('/users/me', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ name }),
  });
  return mapUser(data);
}
