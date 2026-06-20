import { Booking, Seat, User, Zone } from '../types';
import { MAP_H, MAP_W } from '../constants/floorLayout';

export const MOCK_CLUB = {
  name: 'стопкек',
  address: 'Москва, ул. Игровая, 1',
  rating: 5.0,
  hours: '24/7',
};

export { MAP_W, MAP_H };

const SOLO_SUBTITLE = 'Закрытые капсулы для одного человека.';

export const MOCK_ZONES: Zone[] = [
  {
    id: 'solo',
    name: 'СОЛО КАПСУЛЫ',
    specs: SOLO_SUBTITLE,
    pricePerHour: 150,
    labelX: 180,
    labelY: 26,
  },
];

/** Координаты как в stopkek-api/prisma/floor-layout.ts */
const CAPSULES = [
  { number: 1, x: 116, y: 54, w: 34, h: 34 },
  { number: 2, x: 210, y: 54, w: 34, h: 34 },
  { number: 3, x: 116, y: 122, w: 34, h: 34 },
  { number: 4, x: 210, y: 122, w: 34, h: 34 },
];

const statuses: Array<'free' | 'occupied' | 'reserved' | 'repair'> = [
  'free',
  'occupied',
  'free',
  'reserved',
];

export const MOCK_SEATS: Seat[] = CAPSULES.map((c, i) => ({
  id: String(c.number),
  number: c.number,
  zoneId: 'solo',
  x: c.x,
  y: c.y,
  w: c.w,
  h: c.h,
  status: statuses[i],
}));

export const MOCK_USER: User = {
  id: '1',
  phone: '+79001234567',
  name: 'Игрок',
  balance: 1250,
};

export const MOCK_ACTIVE_BOOKING: Booking = {
  id: 'b-active',
  seatNumbers: [1],
  zoneName: 'СОЛО КАПСУЛЫ',
  startAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
  totalPrice: 560,
  status: 'active',
};

export const MOCK_UPCOMING_BOOKING: Booking | null = null;

export const MOCK_BOOKING_HISTORY: Booking[] = [
  {
    id: 'b1',
    seatNumbers: [2],
    zoneName: 'СОЛО КАПСУЛЫ',
    startAt: '2026-05-10T18:00:00',
    endAt: '2026-05-10T22:00:00',
    totalPrice: 880,
    status: 'completed',
  },
  {
    id: 'b2',
    seatNumbers: [3],
    zoneName: 'СОЛО КАПСУЛЫ',
    startAt: '2026-05-08T14:00:00',
    endAt: '2026-05-08T17:00:00',
    totalPrice: 450,
    status: 'completed',
  },
];

export const MOCK_CALL_CODE = '1234';
