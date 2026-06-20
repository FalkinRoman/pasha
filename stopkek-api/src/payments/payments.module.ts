import { Module } from '@nestjs/common';
import { YooKassaService } from './yookassa.service';

@Module({
  providers: [YooKassaService],
  exports: [YooKassaService],
})
export class PaymentsModule {}
