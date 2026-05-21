import type { Seat } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export function defaultCellLock(seatNumber: number) {
  return `cell-${seatNumber}`;
}

/** Привязка mock-замка к месту, если в БД пусто */
export async function ensureSeatCellLock(
  prisma: PrismaService,
  seat: Pick<Seat, 'id' | 'number' | 'cellLock' | 'lockId'>
): Promise<string> {
  const existing = seat.cellLock?.trim() || seat.lockId?.trim();
  if (existing) return existing;

  const cellLock = defaultCellLock(seat.number);
  await prisma.seat.update({
    where: { id: seat.id },
    data: { cellLock, lockId: cellLock },
  });
  return cellLock;
}
