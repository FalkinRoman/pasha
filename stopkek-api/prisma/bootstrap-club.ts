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
      address: '141407, Московская обл., г. Химки, Юбилейный просп., 1, корп. 5',
      rating: 5,
      hours: '24/7',
      supportEmail: 'stopkeksprt@yandex.ru',
      supportPhone: '+7 (915) 219-97-99',
      operatorName: 'ИП Левков Павел Олегович',
      inn: '774395265597',
      ogrnip: '321774600480472',
      legalAddress: '125183, г. Москва, ул. Большая Академическая, д. 73/3, кв. 231',
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
      },
    });
  }

  const packages = [
    { minHours: 3, discountPercent: 7,  label: 'Пакет 3 ч', badge: '−7%',  sortOrder: 0 },
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

  console.log('Клуб создан:', club.name, '— 4 соло-капсулы, тарифы по умолчанию.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
