import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { KioskController } from './kiosk.controller';
import { KioskGuard } from './kiosk.guard';
import { KioskService } from './kiosk.service';
import { KioskTelemetryService } from './kiosk-telemetry.service';

@Module({
  imports: [BookingsModule],
  controllers: [KioskController],
  providers: [KioskService, KioskGuard, KioskTelemetryService],
  exports: [KioskService, KioskTelemetryService],
})
export class KioskModule {}
