/**
 * Пересоздать зоны/места под соло-капсулы (осторожно: снимает все брони).
 * npm run floor:reseed
 */
import { PrismaClient } from '@prisma/client';
import { buildSoloCapsuleLayouts, SOLO_ZONE } from './floor-layout';

const prisma = new PrismaClient();

async function main() {
  const club = await prisma.club.findFirst();
  if (!club) {
    console.error('Клуб не найден — сначала bootstrap:club');
    process.exit(1);
  }

  const bookings = await prisma.booking.count();
  const force = process.argv.includes('--force');
  if (bookings > 0 && !force) {
    console.error(
      `В БД ${bookings} броней. Запусти: npm run floor:reseed -- --force`
    );
    process.exit(1);
  }
  if (bookings > 0) {
    await prisma.booking.deleteMany();
    console.log('Удалены брони:', bookings);
  }

  await prisma.seat.deleteMany({ where: { zone: { clubId: club.id } } });
  await prisma.zone.deleteMany({ where: { clubId: club.id } });

  const zone = await prisma.zone.create({
    data: {
      clubId: club.id,
      slug: SOLO_ZONE.slug,
      name: SOLO_ZONE.name,
      specs: SOLO_ZONE.subtitle,
      pricePerHour: SOLO_ZONE.pricePerHour,
      labelX: SOLO_ZONE.labelX,
      labelY: SOLO_ZONE.labelY,
      sortOrder: SOLO_ZONE.sortOrder,
    },
  });

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
      },
    });
  }

  console.log(`Зал обновлён: 1 зона «${SOLO_ZONE.name}», ${buildSoloCapsuleLayouts().length} мест.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
