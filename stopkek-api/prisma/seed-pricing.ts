/**
 * Дефолтные пакеты и ночной тариф для существующего клуба.
 * npm run seed:pricing
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PACKAGES = [
  { minHours: 3, discountPercent: 10, label: 'Пакет 3 ч', badge: '−10%', sortOrder: 0 },
  { minHours: 4, discountPercent: 15, label: 'Пакет 4 ч', badge: '−15%', recommended: true, sortOrder: 1 },
  { minHours: 6, discountPercent: 20, label: 'Пакет 6 ч', badge: '−20%', sortOrder: 2 },
  { minHours: 8, discountPercent: 25, label: 'Пакет 8 ч', badge: '−25%', sortOrder: 3 },
];

async function main() {
  const club = await prisma.club.findFirst();
  if (!club) {
    console.error('Клуб не найден — сначала bootstrap:club');
    process.exit(1);
  }

  const existing = await prisma.durationPackage.count({ where: { clubId: club.id } });
  if (existing === 0) {
    for (const p of DEFAULT_PACKAGES) {
      await prisma.durationPackage.create({
        data: {
          clubId: club.id,
          minHours: p.minHours,
          discountPercent: p.discountPercent,
          label: p.label,
          badge: p.badge,
          recommended: p.recommended ?? false,
          sortOrder: p.sortOrder,
        },
      });
    }
    console.log('Создано пакетов:', DEFAULT_PACKAGES.length);
  } else {
    console.log('Пакеты уже есть, пропуск');
  }

  const night = await prisma.nightPricing.findFirst({
    where: { clubId: club.id, zoneId: null },
  });
  if (!night) {
    await prisma.nightPricing.create({
      data: {
        clubId: club.id,
        startHour: 23,
        endHour: 7,
        discountPercent: 20,
      },
    });
    console.log('Ночной тариф: 23:00–07:00, −20%');
  } else {
    console.log('Ночной тариф уже есть');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
