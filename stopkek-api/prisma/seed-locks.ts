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
  console.log('Пример ячейки: cell-1 … cell-25');

  const existingLogs = await prisma.lockerLog.count();
  if (existingLogs > 0) {
    console.log(`LockerLog уже есть (${existingLogs}), backfill пропущен`);
    return;
  }

  const reports = await prisma.acceptanceReport.findMany({
    include: {
      booking: { include: { seats: { include: { seat: true } } } },
    },
  });
  for (const r of reports) {
    const bs = r.booking.seats[0];
    const seat = bs?.seat;
    const cellLock =
      seat?.cellLock?.trim() ||
      seat?.lockId?.trim() ||
      defaultCellLock(bs?.seatNumber ?? 0);
    await prisma.lockerLog.create({
      data: {
        bookingId: r.bookingId,
        userId: r.userId,
        seatId: bs?.seatId,
        seatNumber: bs?.seatNumber ?? 0,
        cellLock,
        type: 'acceptance',
        photoPath: r.photoPath,
        payload: { items: r.items, hasIssue: r.hasIssue, backfill: true },
        createdAt: r.createdAt,
      },
    });
  }

  const checkouts = await prisma.booking.findMany({
    where: { checkoutPhotoPath: { not: null } },
    include: { seats: { include: { seat: true } } },
  });
  for (const b of checkouts) {
    const bs = b.seats[0];
    const seat = bs?.seat;
    const cellLock =
      seat?.cellLock?.trim() ||
      seat?.lockId?.trim() ||
      defaultCellLock(bs?.seatNumber ?? 0);
    await prisma.lockerLog.create({
      data: {
        bookingId: b.id,
        userId: b.userId,
        seatId: bs?.seatId,
        seatNumber: bs?.seatNumber ?? 0,
        cellLock,
        type: 'checkout',
        photoPath: b.checkoutPhotoPath,
        payload: { backfill: true },
        createdAt: b.updatedAt,
      },
    });
  }

  console.log(
    `Backfill: приёмок ${reports.length}, checkout ${checkouts.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
