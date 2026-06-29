/**
 * Дефолтные пакеты и тарифы по времени для существующего клуба.
 * npm run seed:pricing
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PACKAGES = [
  { minHours: 3, discountPercent: 7, label: 'Пакет 3 ч', badge: '−7%', sortOrder: 0 },
  { minHours: 6, discountPercent: 13, label: 'Пакет 6 ч', badge: '−13%', sortOrder: 1 },
  { minHours: 8, discountPercent: 16, label: 'Пакет 8 ч', badge: '−16%', recommended: true, sortOrder: 2 },
];

const DEFAULT_TIME_WINDOWS = [
  { startHour: 23, endHour: 8, discountPercent: 36 },
  { startHour: 10, endHour: 16, discountPercent: 26 },
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

  const windows = await prisma.nightPricing.count({ where: { clubId: club.id } });
  if (windows === 0) {
    for (const w of DEFAULT_TIME_WINDOWS) {
      await prisma.nightPricing.create({
        data: { clubId: club.id, ...w },
      });
    }
    console.log('Созданы тарифы по времени: ночь 23–08 −36%, утро 10–16 −26%');
  } else {
    console.log('Тарифы по времени уже есть, пропуск');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
