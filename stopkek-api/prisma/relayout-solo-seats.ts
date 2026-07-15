/**
 * Добавить недостающие места и пересчитать координаты на карте (без удаления зоны).
 * npm run floor:relayout
 * npm run floor:relayout -- --target=7
 */
import { PrismaClient } from '@prisma/client';
import {
  buildCapsuleGridLayouts,
  buildSoloCapsuleLayouts,
  SOLO_DEFAULT_SEAT_COUNT,
  SOLO_ZONE,
} from './floor-layout';

const prisma = new PrismaClient();

function parseTarget(): number {
  const arg = process.argv.find((a) => a.startsWith('--target='));
  if (!arg) return SOLO_DEFAULT_SEAT_COUNT;
  const n = Number(arg.split('=')[1]);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('--target must be a positive integer');
  }
  return Math.floor(n);
}

async function main() {
  const target = parseTarget();
  const club = await prisma.club.findFirst();
  if (!club) {
    console.error('Клуб не найден — сначала bootstrap:club');
    process.exit(1);
  }

  let zone = await prisma.zone.findFirst({
    where: { clubId: club.id, slug: SOLO_ZONE.slug },
    include: { seats: { orderBy: { number: 'asc' } } },
  });

  if (!zone) {
    zone = await prisma.zone.create({
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
      include: { seats: { orderBy: { number: 'asc' } } },
    });
    console.log('Создана зона', zone.name);
  }

  const layouts =
    target === SOLO_DEFAULT_SEAT_COUNT
      ? buildSoloCapsuleLayouts()
      : buildCapsuleGridLayouts(target);

  for (const layout of layouts) {
    const existing = zone.seats.find((s) => s.number === layout.number);
    if (existing) {
      await prisma.seat.update({
        where: { id: existing.id },
        data: {
          x: layout.x,
          y: layout.y,
          w: layout.w,
          h: layout.h,
        },
      });
    } else {
      await prisma.seat.create({
        data: {
          zoneId: zone.id,
          number: layout.number,
          x: layout.x,
          y: layout.y,
          w: layout.w,
          h: layout.h,
          status: 'free',
        },
      });
      console.log('Добавлено место №', layout.number);
    }
  }

  const count = await prisma.seat.count({ where: { zoneId: zone.id } });
  console.log(`Готово: зона «${zone.name}», ${count} мест, сетка под ${target}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
