/**
 * Главная дверь клуба (mock / main-door).
 * npm run seed:locks
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const club = await prisma.club.findFirst();
  if (!club) {
    console.error('Клуб не найден — сначала bootstrap:club');
    process.exit(1);
  }

  if (!club.mainDoorLockId) {
    await prisma.club.update({
      where: { id: club.id },
      data: {
        mainDoorLockId: 'main-door',
        lockProvider: club.lockProvider ?? 'mock',
      },
    });
    console.log('Клуб: main-door (mock)');
  } else {
    console.log('Главная дверь уже настроена:', club.mainDoorLockId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
