/**
 * Обновляет тарифы в существующей БД до актуальных значений.
 * Запуск: npx tsx prisma/reset-pricing.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const club = await prisma.club.findFirst();
  if (!club) {
    console.error('Клуб не найден — сначала запусти bootstrap-club.ts');
    process.exit(1);
  }

  // Сносим старые пакеты и ночные тарифы
  await prisma.durationPackage.deleteMany({ where: { clubId: club.id } });
  await prisma.nightPricing.deleteMany({ where: { clubId: club.id } });

  const packages = [
    { minHours: 3, discountPercent: 7, label: 'Пакет 3 ч', badge: '−7%', sortOrder: 0 },
    { minHours: 6, discountPercent: 13, label: 'Пакет 6 ч', badge: '−13%', sortOrder: 1 },
    { minHours: 8, discountPercent: 16, label: 'Пакет 8 ч', badge: '−16%', recommended: true, sortOrder: 2 },
  ];
  for (const p of packages) {
    await prisma.durationPackage.create({ data: { clubId: club.id, ...p } });
  }

  // Ночной тариф 23:00–08:00 (-36%)
  await prisma.nightPricing.create({
    data: { clubId: club.id, startHour: 23, endHour: 8, discountPercent: 36 },
  });
  // Утренний тариф 10:00–16:00 (-26%)
  await prisma.nightPricing.create({
    data: { clubId: club.id, startHour: 10, endHour: 16, discountPercent: 26 },
  });

  console.log('Тарифы обновлены:', club.name);
  console.log('  Пакеты: 3ч −7%, 6ч −13%, 8ч −16% (recommended)');
  console.log('  Ночной 23:00–08:00 −36%, Утренний 10:00–16:00 −26%');
  console.log('  Дневная (базовая) цена за час — в зоне (pricePerHour), правится в админке.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
