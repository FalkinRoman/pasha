import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LockerModule } from '../locker/locker.module';
import { LocksModule } from '../locks/locks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, LocksModule, LockerModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
