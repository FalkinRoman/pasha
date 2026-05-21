import { Module } from '@nestjs/common';
import { LockerLogService } from './locker-log.service';

@Module({
  providers: [LockerLogService],
  exports: [LockerLogService],
})
export class LockerModule {}
