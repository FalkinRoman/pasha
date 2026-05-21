/**
 * Одноразовая разметка клуба (зоны + 25 мест, все free).
 * Не создаёт пользователей, брони, транзакции.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEAT_W = 22;
const SEAT_H = 22;
const SEAT_GAP = 4;
const STEP = SEAT_W + SEAT_GAP;
const INNER_PAD = 12;
const LABEL_COL_W = 74;
const LABEL_GRID_GAP = 10;
const GRID_X = INNER_PAD + LABEL_COL_W + LABEL_GRID_GAP;
const GRID_Y = 32;

const zoneLabelY = (row: number) => GRID_Y + row * STEP + SEAT_H / 2 + 5;

function zoneForSeat(n: number) {
  if (n <= 5) return 'normal';
  if (n <= 10) return 'vip1';
  if (n <= 15) return 'vip2';
  return 'bootcamp';
}

async function main() {
  const existing = await prisma.club.findFirst();
  if (existing) {
    console.error('Клуб уже есть:', existing.name, '— сначала npm run db:clear');
    process.exit(1);
  }

  const club = await prisma.club.create({
    data: {
      name: 'стопкек',
      address: '',
      rating: 5,
      hours: '24/7',
      supportEmail: 'stopkeksprt@mail.ru',
      zones: {
        create: [
          {
            slug: 'normal',
            name: 'Normal',
            specs: '',
            pricePerHour: 150,
            labelX: INNER_PAD,
            labelY: zoneLabelY(0),
            sortOrder: 0,
          },
          {
            slug: 'vip1',
            name: 'VIP-1',
            specs: '',
            pricePerHour: 220,
            labelX: INNER_PAD,
            labelY: zoneLabelY(1),
            sortOrder: 1,
          },
          {
            slug: 'vip2',
            name: 'VIP-2',
            specs: '',
            pricePerHour: 220,
            labelX: INNER_PAD,
            labelY: zoneLabelY(2),
            sortOrder: 2,
          },
          {
            slug: 'bootcamp',
            name: 'Bootcamp',
            specs: '',
            pricePerHour: 280,
            labelX: INNER_PAD,
            labelY: zoneLabelY(3),
            sortOrder: 3,
          },
        ],
      },
    },
    include: { zones: true },
  });

  const zoneBySlug = Object.fromEntries(club.zones.map((z) => [z.slug, z]));

  for (let i = 0; i < 25; i++) {
    const n = i + 1;
    const row = Math.floor((n - 1) / 5);
    const col = (n - 1) % 5;
    const slug = zoneForSeat(n);
    await prisma.seat.create({
      data: {
        zoneId: zoneBySlug[slug].id,
        number: n,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        w: SEAT_W,
        h: SEAT_H,
        status: 'free',
      },
    });
  }

  console.log('Клуб создан:', club.name, '— 4 зоны, 25 мест (все free).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
