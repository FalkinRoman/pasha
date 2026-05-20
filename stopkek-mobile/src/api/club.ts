import { Seat, Zone } from '../types';
import { apiFetch } from './client';

export type ClubInfo = {
  id: string;
  name: string;
  address: string;
  rating: number;
  hours: string;
  zones: { id: string; name: string; specs: string; pricePerHour: number }[];
};

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
