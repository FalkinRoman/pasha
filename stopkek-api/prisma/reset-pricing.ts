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

  // Пакеты длительности: 3 / 5 / 6 / 9 часов
  const packages = [
    { minHours: 3, discountPercent: 10, label: 'Пакет 3 ч', badge: '−10%', sortOrder: 0 },
    { minHours: 5, discountPercent: 15, label: 'Пакет 5 ч', badge: '−15%', recommended: true, sortOrder: 1 },
    { minHours: 6, discountPercent: 20, label: 'Пакет 6 ч', badge: '−20%', sortOrder: 2 },
    { minHours: 9, discountPercent: 25, label: 'Пакет 9 ч', badge: '−25%', sortOrder: 3 },
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
  console.log('  Пакеты: 3ч −10%, 5ч −15% (recommended), 6ч −20%, 9ч −25%');
  console.log('  Ночной 23:00–08:00 −36%, Утренний 10:00–16:00 −26%');
  console.log('  Дневная (базовая) цена за час — в зоне (pricePerHour), правится в админке.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
