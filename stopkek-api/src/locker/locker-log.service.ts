import { Injectable } from '@nestjs/common';
import { LockerLogType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LockerLogInput = {
  bookingId?: string;
  userId: string;
  seatId?: string;
  seatNumber: number;
  cellLock: string;
  type: LockerLogType;
  photoPath?: string | null;
  payload?: Prisma.InputJsonValue;
};

@Injectable()
export class LockerLogService {
  constructor(private readonly prisma: PrismaService) {}

  write(entry: LockerLogInput) {
    return this.prisma.lockerLog.create({
      data: {
        bookingId: entry.bookingId,
        userId: entry.userId,
        seatId: entry.seatId,
        seatNumber: entry.seatNumber,
        cellLock: entry.cellLock,
        type: entry.type,
        photoPath: entry.photoPath ?? undefined,
        payload: entry.payload,
      },
    });
  }
}
