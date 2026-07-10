import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';

type YooKassaWebhookBody = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    metadata?: { paymentId?: string; userId?: string };
  };
};

@Controller('payments/yookassa')
export class PaymentsController {
  constructor(private readonly wallet: WalletService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() body: YooKassaWebhookBody) {
    return this.wallet.handleYookassaWebhook(body);
  }
}
