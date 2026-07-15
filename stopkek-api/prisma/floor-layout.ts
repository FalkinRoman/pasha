/**
 * Разметка зала: соло-капсулы на SVG-холсте MAP_W×MAP_H.
 * При добавлении мест в админке координаты пересчитываются через buildCapsuleGridLayouts.
 */
export const SOLO_DEFAULT_SEAT_COUNT = 7;

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

export const SEAT_W = 34;
export const SEAT_H = 34;

type GridMetrics = {
  roomW: number;
  roomH: number;
  colGap: number;
  rowGap: number;
  originY: number;
};

/** Сколько капсул в каждом ряду (сверху вниз). */
export function computeRowDistribution(seatCount: number): number[] {
  if (seatCount <= 0) return [];
  if (seatCount <= 4) return [seatCount];
  if (seatCount === 5) return [3, 2];
  if (seatCount === 6) return [3, 3];
  if (seatCount === 7) return [4, 3];
  if (seatCount === 8) return [4, 4];

  const rows: number[] = [];
  let left = seatCount;
  while (left > 0) {
    const n = Math.min(4, left);
    rows.push(n);
    left -= n;
  }
  return rows;
}

function gridMetrics(maxColsInRow: number): GridMetrics {
  if (maxColsInRow <= 3) {
    return { roomW: 82, roomH: 54, colGap: 12, rowGap: 14, originY: 52 };
  }
  return { roomW: 76, roomH: 52, colGap: 10, rowGap: 12, originY: 50 };
}

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

/** Координаты для N мест (номера 1…N слева-направо, сверху-вниз). */
export function buildCapsuleGridLayouts(seatCount: number): CapsuleLayout[] {
  const rows = computeRowDistribution(seatCount);
  if (!rows.length) return [];

  const maxCols = Math.max(...rows);
  const { roomW, roomH, colGap, rowGap, originY } = gridMetrics(maxCols);

  const layouts: CapsuleLayout[] = [];
  let number = 1;
  let rowY = originY;

  for (const colsInRow of rows) {
    const gridW = colsInRow * roomW + (colsInRow - 1) * colGap;
    const originX = (MAP_W - gridW) / 2;

    for (let col = 0; col < colsInRow; col++) {
      const roomX = originX + col * (roomW + colGap);
      layouts.push({
        number,
        roomX,
        roomY: rowY,
        roomW,
        roomH,
        x: roomX + (roomW - SEAT_W) / 2,
        y: rowY + (roomH - SEAT_H) / 2,
        w: SEAT_W,
        h: SEAT_H,
      });
      number += 1;
    }

    rowY += roomH + rowGap;
  }

  return layouts;
}

export function buildSoloCapsuleLayouts(): CapsuleLayout[] {
  return buildCapsuleGridLayouts(SOLO_DEFAULT_SEAT_COUNT);
}
