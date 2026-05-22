/**
 * Привязка замков к местам (существующая БД).
 * npm run seed:locks
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function defaultCellLock(seatNumber: number) {
  return `cell-${seatNumber}`;
}

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
  }

  const seats = await prisma.seat.findMany({ orderBy: { number: 'asc' } });
  let updated = 0;
  for (const s of seats) {
    const cellLock = s.cellLock?.trim() || defaultCellLock(s.number);
    const lockId = s.lockId?.trim() || cellLock;
    if (s.cellLock !== cellLock || s.lockId !== lockId) {
      await prisma.seat.update({
        where: { id: s.id },
        data: { cellLock, lockId },
      });
      updated++;
    }
  }

  console.log(`Мест: ${seats.length}, обновлено: ${updated}`);
  console.log('ID боксов: cell-1 … cell-25 (настраиваются в админке → Места)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
