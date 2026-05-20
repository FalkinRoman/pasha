import { Booking, Seat, User, Zone } from '../types';

export const MOCK_CLUB = {
  name: 'stopkek',
  address: 'Москва, ул. Игровая, 1',
  rating: 5.0,
  hours: '24/7',
};

/** Координаты viewBox карты — симметричные отступы слева/справа */
export const SEAT_W = 22;
export const SEAT_H = 22;
const SEAT_GAP = 4;
const STEP = SEAT_W + SEAT_GAP;

const INNER_PAD = 12;
const LABEL_COL_W = 74;
const LABEL_GRID_GAP = 10;
const GRID_COLS = 5;
const GRID_ROWS = 5;

const GRID_W = GRID_COLS * SEAT_W + (GRID_COLS - 1) * SEAT_GAP;
const GRID_H = GRID_ROWS * SEAT_H + (GRID_ROWS - 1) * SEAT_GAP;

export const GRID_X = INNER_PAD + LABEL_COL_W + LABEL_GRID_GAP;
export const GRID_Y = 32;

export const MAP_W = INNER_PAD + LABEL_COL_W + LABEL_GRID_GAP + GRID_W + INNER_PAD;
export const MAP_H = GRID_Y + GRID_H + INNER_PAD;

const zoneLabelY = (row: number) => GRID_Y + row * STEP + SEAT_H / 2 + 5;

export const MOCK_ZONES: Zone[] = [
  {
    id: 'normal',
    name: 'Normal',
    specs: '4060 · 165Hz',
    pricePerHour: 150,
    labelX: INNER_PAD,
    labelY: zoneLabelY(0),
  },
  {
    id: 'vip1',
    name: 'VIP-1',
    specs: '4060Ti · 240',
    pricePerHour: 220,
    labelX: INNER_PAD,
    labelY: zoneLabelY(1),
  },
  {
    id: 'vip2',
    name: 'VIP-2',
    specs: '4060Ti · 240',
    pricePerHour: 220,
    labelX: INNER_PAD,
    labelY: zoneLabelY(2),
  },
  {
    id: 'bootcamp',
    name: 'Bootcamp',
    specs: '4070S · 280',
    pricePerHour: 280,
    labelX: INNER_PAD,
    labelY: zoneLabelY(3),
  },
];

const zoneForSeat = (n: number): string => {
  if (n <= 5) return 'normal';
  if (n <= 15) return n <= 10 ? 'vip1' : 'vip2';
  return 'bootcamp';
};

const statuses: Array<'free' | 'occupied' | 'reserved' | 'repair'> = [
  'free', 'occupied', 'free', 'free', 'reserved',
  'free', 'occupied', 'free', 'free', 'free',
  'free', 'free', 'occupied', 'free', 'free',
  'free', 'free', 'free', 'occupied', 'free',
  'free', 'free', 'free', 'free', 'repair',
];

export const MOCK_SEATS: Seat[] = Array.from({ length: 25 }, (_, i) => {
  const n = i + 1;
  const row = Math.floor((n - 1) / 5);
  const col = (n - 1) % 5;
  return {
    id: String(n),
    number: n,
    zoneId: zoneForSeat(n),
    x: GRID_X + col * STEP,
    y: GRID_Y + row * STEP,
    w: SEAT_W,
    h: SEAT_H,
    status: statuses[i],
  };
});

export const MOCK_USER: User = {
  id: '1',
  phone: '+79001234567',
  name: 'Игрок',
  balance: 1250,
};

export const MOCK_ACTIVE_BOOKING: Booking = {
  id: 'b-active',
  seatNumbers: [17],
  zoneName: 'Bootcamp',
  startAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
  totalPrice: 560,
  status: 'active',
};

export const MOCK_UPCOMING_BOOKING: Booking | null = null;

export const MOCK_BOOKING_HISTORY: Booking[] = [
  {
    id: 'b1',
    seatNumbers: [12],
    zoneName: 'VIP-2',
    startAt: '2026-05-10T18:00:00',
    endAt: '2026-05-10T22:00:00',
    totalPrice: 880,
    status: 'completed',
  },
  {
    id: 'b2',
    seatNumbers: [3],
    zoneName: 'Normal',
    startAt: '2026-05-08T14:00:00',
    endAt: '2026-05-08T17:00:00',
    totalPrice: 450,
    status: 'completed',
  },
];

/** Для демо входа по звонку */
export const MOCK_CALL_CODE = '1234';
