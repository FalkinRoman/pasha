-- Duration packages & night pricing
CREATE TABLE "DurationPackage" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "zoneId" TEXT,
    "minHours" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "badge" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "DurationPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NightPricing" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "zoneId" TEXT,
    "startHour" INTEGER NOT NULL DEFAULT 23,
    "endHour" INTEGER NOT NULL DEFAULT 7,
    "discountPercent" INTEGER NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NightPricing_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" ADD COLUMN "basePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "DurationPackage_clubId_active_idx" ON "DurationPackage"("clubId", "active");
CREATE INDEX "NightPricing_clubId_active_idx" ON "NightPricing"("clubId", "active");

ALTER TABLE "DurationPackage" ADD CONSTRAINT "DurationPackage_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DurationPackage" ADD CONSTRAINT "DurationPackage_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NightPricing" ADD CONSTRAINT "NightPricing_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NightPricing" ADD CONSTRAINT "NightPricing_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
