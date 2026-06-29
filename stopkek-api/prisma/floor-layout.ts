/**
 * Разметка зала: 6 соло-капсул (сетка 3×2) + координаты для SVG.
 */
export const SOLO_ZONE = {
  slug: 'solo',
  name: 'СОЛО КАПСУЛЫ',
  subtitle: 'Закрытые капсулы для одного человека.',
  pricePerHour: 150,
  labelX: 180,
  labelY: 26,
  sortOrder: 0,
} as const;

export const SOLO_CONFIG_TITLE = 'Соло-капсула';

export const SOLO_CONFIG_LINES: { label: string; value: string }[] = [
  { label: 'Процессор', value: 'RYZEN 7 7800 X3D' },
  { label: 'Видеокарта', value: 'RTX 5070' },
  { label: 'Монитор', value: '27" 2K 300 Гц' },
  { label: 'Клавиатура', value: 'Магнитная 75%' },
  { label: 'Наушники', value: 'MCHOSE v9 pro' },
  { label: 'Мышь', value: 'Attack Shark R11 Ultra' },
];

export const MAP_W = 360;
export const MAP_H = 190;
export const MAP_CENTER_X = MAP_W / 2;

const ROOM_W = 82;
const ROOM_H = 54;
const SEAT_W = 34;
const SEAT_H = 34;
const COL_GAP = 12;
const ROW_GAP = 14;

// 6 капсул: 3 столбца × 2 ряда. Сетка 270×122 центрируется в холсте 360×190.
const COLS = 3;
const ROWS = 2;

const GRID_W = ROOM_W * COLS + COL_GAP * (COLS - 1);
const GRID_H = ROOM_H * ROWS + ROW_GAP * (ROWS - 1);
const ORIGIN_X = (MAP_W - GRID_W) / 2;
const ORIGIN_Y = 52;

// Нумерация слева-направо, сверху-вниз: 1-2-3 верхний ряд, 4-5-6 нижний.
const CAPSULE_ORIGINS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    number: i + 1,
    roomX: ORIGIN_X + col * (ROOM_W + COL_GAP),
    roomY: ORIGIN_Y + row * (ROOM_H + ROW_GAP),
  };
});

export type CapsuleLayout = {
  number: number;
  roomX: number;
  roomY: number;
  roomW: number;
  roomH: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function buildSoloCapsuleLayouts(): CapsuleLayout[] {
  return CAPSULE_ORIGINS.map(({ number, roomX, roomY }) => ({
    number,
    roomX,
    roomY,
    roomW: ROOM_W,
    roomH: ROOM_H,
    x: roomX + (ROOM_W - SEAT_W) / 2,
    y: roomY + (ROOM_H - SEAT_H) / 2,
    w: SEAT_W,
    h: SEAT_H,
  }));
}
