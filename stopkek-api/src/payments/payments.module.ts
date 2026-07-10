import { Module, forwardRef } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentsController } from './payments.controller';
import { YooKassaService } from './yookassa.service';

@Module({
  imports: [forwardRef(() => WalletModule)],
  controllers: [PaymentsController],
  providers: [YooKassaService, PaymentSettingsService],
  exports: [YooKassaService, PaymentSettingsService],
})
export class PaymentsModule {}
