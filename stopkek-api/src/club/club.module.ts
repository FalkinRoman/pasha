import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';

@Module({
  imports: [BookingsModule],
  controllers: [ClubController],
  providers: [ClubService],
  exports: [ClubService],
})
export class ClubModule {}
