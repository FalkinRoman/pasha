-- PC kiosk: факт разблокировки места кодом из приложения
ALTER TABLE "Booking" ADD COLUMN "pcUnlockedAt" TIMESTAMP(3);
