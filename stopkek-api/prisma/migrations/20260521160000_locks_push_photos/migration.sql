CREATE TYPE "LockProvider" AS ENUM ('mock', 'http', 'mqtt');
CREATE TYPE "NotificationType" AS ENUM ('session_start', 'session_remind_15', 'session_end', 'promo');

ALTER TABLE "User" ADD COLUMN "notifySession" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyRemind15" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyPromo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Club" ADD COLUMN "lockProvider" "LockProvider" NOT NULL DEFAULT 'mock';
ALTER TABLE "Club" ADD COLUMN "mainDoorLockId" TEXT;
ALTER TABLE "Club" ADD COLUMN "lockHttpBaseUrl" TEXT;
ALTER TABLE "Club" ADD COLUMN "lockHttpToken" TEXT;
ALTER TABLE "Club" ADD COLUMN "lockMqttTopic" TEXT;

ALTER TABLE "Booking" ADD COLUMN "checkoutPhotoPath" TEXT;
ALTER TABLE "AcceptanceReport" ADD COLUMN "photoPath" TEXT;

CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "NotificationType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LockEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "bookingId" TEXT,
    "lockType" TEXT NOT NULL,
    "lockTarget" TEXT NOT NULL,
    "provider" "LockProvider" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LockEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushToken_userId_token_key" ON "PushToken"("userId", "token");
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");
CREATE UNIQUE INDEX "NotificationLog_bookingId_type_key" ON "NotificationLog"("bookingId", "type");
CREATE INDEX "NotificationLog_userId_sentAt_idx" ON "NotificationLog"("userId", "sentAt");
CREATE INDEX "LockEvent_bookingId_createdAt_idx" ON "LockEvent"("bookingId", "createdAt");
CREATE INDEX "LockEvent_createdAt_idx" ON "LockEvent"("createdAt");

ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
