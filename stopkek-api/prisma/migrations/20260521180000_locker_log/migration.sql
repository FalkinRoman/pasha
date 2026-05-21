CREATE TYPE "LockerLogType" AS ENUM ('lock_open_main', 'lock_open_cell', 'acceptance', 'checkout');

CREATE TABLE "LockerLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "userId" TEXT NOT NULL,
    "seatId" TEXT,
    "seatNumber" INTEGER NOT NULL,
    "cellLock" TEXT NOT NULL,
    "type" "LockerLogType" NOT NULL,
    "photoPath" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LockerLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LockerLog_seatNumber_createdAt_idx" ON "LockerLog"("seatNumber", "createdAt");
CREATE INDEX "LockerLog_cellLock_createdAt_idx" ON "LockerLog"("cellLock", "createdAt");
CREATE INDEX "LockerLog_userId_createdAt_idx" ON "LockerLog"("userId", "createdAt");
CREATE INDEX "LockerLog_createdAt_idx" ON "LockerLog"("createdAt");

ALTER TABLE "LockerLog" ADD CONSTRAINT "LockerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LockerLog" ADD CONSTRAINT "LockerLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LockerLog" ADD CONSTRAINT "LockerLog_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
