CREATE TYPE "SessionPhase" AS ENUM (
  'awaiting_arrival',
  'arrival',
  'cell_pending',
  'acceptance',
  'issue',
  'playing',
  'checkout'
);

ALTER TABLE "Booking" ADD COLUMN "sessionPhase" "SessionPhase" NOT NULL DEFAULT 'awaiting_arrival';
ALTER TABLE "Booking" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 60;

UPDATE "Booking" SET "durationMinutes" = GREATEST(
  1,
  CAST(EXTRACT(EPOCH FROM ("endAt" - "startAt")) / 60 AS INTEGER)
) WHERE "durationMinutes" = 60;

UPDATE "Booking" SET "sessionPhase" = 'playing' WHERE "status" = 'active';

CREATE TABLE "AcceptanceReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "hasIssue" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcceptanceReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcceptanceReport_resolved_createdAt_idx" ON "AcceptanceReport"("resolved", "createdAt");
CREATE INDEX "AcceptanceReport_bookingId_idx" ON "AcceptanceReport"("bookingId");

ALTER TABLE "AcceptanceReport" ADD CONSTRAINT "AcceptanceReport_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
