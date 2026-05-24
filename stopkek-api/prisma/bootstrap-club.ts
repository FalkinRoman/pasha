/**
 * Одноразовая разметка клуба: 1 зона, 4 соло-капсулы (все free).
 */
import { PrismaClient } from '@prisma/client';
import { buildSoloCapsuleLayouts, SOLO_ZONE } from './floor-layout';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.club.findFirst();
  if (existing) {
    console.error('Клуб уже есть:', existing.name, '— сначала npm run db:clear или npm run floor:reseed');
    process.exit(1);
  }

  const club = await prisma.club.create({
    data: {
      name: 'стопкек',
      address: '',
      rating: 5,
      hours: '24/7',
      supportEmail: 'stopkeksprt@yandex.ru',
      mainDoorLockId: 'main-door',
      lockProvider: 'mock',
      zones: {
        create: [
          {
            slug: SOLO_ZONE.slug,
            name: SOLO_ZONE.name,
            specs: SOLO_ZONE.subtitle,
            pricePerHour: SOLO_ZONE.pricePerHour,
            labelX: SOLO_ZONE.labelX,
            labelY: SOLO_ZONE.labelY,
            sortOrder: SOLO_ZONE.sortOrder,
          },
        ],
      },
    },
    include: { zones: true },
  });

  const zone = club.zones[0];
  for (const cap of buildSoloCapsuleLayouts()) {
    await prisma.seat.create({
      data: {
        zoneId: zone.id,
        number: cap.number,
        x: cap.x,
        y: cap.y,
        w: cap.w,
        h: cap.h,
        status: 'free',
        cellLock: `cell-${cap.number}`,
        lockId: `cell-${cap.number}`,
      },
    });
  }

  console.log('Клуб создан:', club.name, '— 4 соло-капсулы (все free).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
