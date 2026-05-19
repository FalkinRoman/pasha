import { PrismaClient, SeatStatus } from '@prisma/client';

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

/** Статусы только из реальных броней; в seed — все свободны, кроме repair */
function seatStatus(n: number): SeatStatus {
  return n === 25 ? 'repair' : 'free';
}

function zoneForSeat(n: number) {
  if (n <= 5) return 'normal';
  if (n <= 10) return 'vip1';
  if (n <= 15) return 'vip2';
  return 'bootcamp';
}

async function main() {
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.club.deleteMany();

  const club = await prisma.club.create({
    data: {
      name: 'stopkek',
      address: 'Москва, ул. Игровая, 1',
      rating: 5,
      hours: '24/7',
      zones: {
        create: [
          {
            slug: 'normal',
            name: 'Normal',
            specs: '4060 · 165Hz',
            pricePerHour: 150,
            labelX: INNER_PAD,
            labelY: zoneLabelY(0),
            sortOrder: 0,
          },
          {
            slug: 'vip1',
            name: 'VIP-1',
            specs: '4060Ti · 240',
            pricePerHour: 220,
            labelX: INNER_PAD,
            labelY: zoneLabelY(1),
            sortOrder: 1,
          },
          {
            slug: 'vip2',
            name: 'VIP-2',
            specs: '4060Ti · 240',
            pricePerHour: 220,
            labelX: INNER_PAD,
            labelY: zoneLabelY(2),
            sortOrder: 2,
          },
          {
            slug: 'bootcamp',
            name: 'Bootcamp',
            specs: '4070S · 280',
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
        status: seatStatus(n),
      },
    });
  }

  console.log('Seed OK:', club.name, '25 seats');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
