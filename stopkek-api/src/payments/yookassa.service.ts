import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

type YooPaymentResponse = {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
};

@Injectable()
export class YooKassaService {
  private readonly logger = new Logger(YooKassaService.name);
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly returnUrl: string;

  constructor(private readonly config: ConfigService) {
    this.shopId = this.config.get<string>('YOOKASSA_SHOP_ID', '');
    this.secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY', '');
    this.returnUrl =
      this.config.get<string>('YOOKASSA_RETURN_URL', 'stopkek://wallet/topup/success');
  }

  get enabled() {
    return Boolean(this.shopId && this.secretKey);
  }

  async createTopupPayment(params: {
    amountRub: number;
    paymentId: string;
    userId: string;
  }) {
    const idempotenceKey = randomUUID();
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');

    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify({
        amount: {
          value: params.amountRub.toFixed(2),
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${this.returnUrl}${this.returnUrl.includes('?') ? '&' : '?'}paymentId=${params.paymentId}`,
        },
        description: 'Пополнение баланса stopkek',
        metadata: {
          paymentId: params.paymentId,
          userId: params.userId,
        },
      }),
    });

    const data = (await res.json()) as YooPaymentResponse & { description?: string };
    if (!res.ok) {
      this.logger.warn(`YooKassa create failed: ${JSON.stringify(data)}`);
      throw new Error(
        typeof data === 'object' && data && 'description' in data
          ? String(data.description)
          : 'YooKassa error'
      );
    }

    return {
      providerId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url ?? null,
      status: data.status,
    };
  }

  async fetchPayment(providerId: string) {
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${providerId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return (await res.json()) as { id: string; status: string };
  }
}
