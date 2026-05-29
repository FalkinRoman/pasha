import { Module } from '@nestjs/common';
import { SmscService } from './smsc.service';

@Module({
  providers: [SmscService],
  exports: [SmscService],
})
export class SmscModule {}
