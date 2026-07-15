/** Синхронно с stopkek-api/prisma/floor-layout.ts */
export const MAP_W = 360;
export const MAP_H = 190;
export const MAP_CENTER_X = MAP_W / 2;
export const SOLO_DEFAULT_SEAT_COUNT = 7;

export const SOLO_ZONE_SUBTITLE = 'Закрытые капсулы для одного человека.';

export const SOLO_CONFIG_TITLE = 'Соло-капсула';

export const SOLO_CONFIG_LINES: { label: string; value: string }[] = [
  { label: 'Процессор', value: 'RYZEN 7 7800 X3D' },
  { label: 'Видеокарта', value: 'RTX 5070' },
  { label: 'Монитор', value: '27" 2K 300 Гц' },
  { label: 'Клавиатура', value: 'Магнитная 75%' },
  { label: 'Наушники', value: 'MCHOSE v9 pro' },
  { label: 'Мышь', value: 'Attack Shark R11 Ultra' },
];

const ROOM_W = 82;
const ROOM_H = 54;

export function capsuleRoomForSeat(seat: { x: number; y: number; w: number; h: number }) {
  const padX = (ROOM_W - seat.w) / 2;
  const padY = (ROOM_H - seat.h) / 2;
  return {
    x: seat.x - padX,
    y: seat.y - padY,
    w: ROOM_W,
    h: ROOM_H,
  };
}

export function zoneSubtitle(specs?: string | null) {
  if (!specs?.trim()) return SOLO_ZONE_SUBTITLE;
  return specs.replace(/,?\s*с\s+личным\s+кондиционером\.?/gi, '.').trim();
}
