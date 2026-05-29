import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { KioskController } from './kiosk.controller';
import { KioskGuard } from './kiosk.guard';
import { KioskService } from './kiosk.service';

@Module({
  imports: [BookingsModule],
  controllers: [KioskController],
  providers: [KioskService, KioskGuard],
  exports: [KioskService],
})
export class KioskModule {}
