import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  /** HTTPS return после оплаты в браузере → редирект в приложение stopkek:// */
  @Get('return')
  returnToApp(@Query('paymentId') paymentId: string | undefined, @Res() res: Response) {
    const id = paymentId?.trim() || '';
    const deepLink = id
      ? `stopkek://wallet/topup/success?paymentId=${encodeURIComponent(id)}`
      : 'stopkek://wallet/topup/success';
    const safeLink = deepLink.replace(/"/g, '&quot;');
    res
      .type('html')
      .send(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=${safeLink}"/>
<title>Возврат в стопКЕК</title></head>
<body style="font-family:sans-serif;text-align:center;padding:2rem;background:#0a0a0a;color:#fff">
<p>Оплата завершена. Возвращаем в приложение…</p>
<p><a href="${safeLink}" style="color:#c41e24">Открыть стопКЕК</a></p>
<script>location.replace(${JSON.stringify(deepLink)});</script>
</body></html>`);
  }
}
