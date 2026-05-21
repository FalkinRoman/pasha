import { API_URL } from '../config/api';
import { Seat, Zone } from '../types';
import { apiFetch } from './client';

export type ClubInfo = {
  id: string;
  name: string;
  address: string;
  rating: number;
  hours: string;
  imageUrl?: string | null;
  supportPhone?: string | null;
  supportTelegram?: string | null;
  supportEmail?: string | null;
  zones?: { id: string; name: string; specs: string; pricePerHour: number }[];
};

export function clubImageUri(imageUrl?: string | null) {
  if (!imageUrl) return null;
  return `${API_URL}${imageUrl}`;
}

type FloorMapResponse = {
  club: { id: string; name: string; address: string; rating: number };
  zones: Zone[];
  seats: Seat[];
};

export async function fetchClub() {
  return apiFetch<ClubInfo>('/club');
}

export async function fetchFloorMap() {
  return apiFetch<FloorMapResponse>('/club/floor-map');
}
