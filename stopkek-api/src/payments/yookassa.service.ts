import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

type YooPaymentResponse = {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
};

type YooErrorResponse = {
  type?: string;
  code?: string;
  description?: string;
  parameter?: string;
};

@Injectable()
export class YooKassaService {
  private readonly logger = new Logger(YooKassaService.name);
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly returnUrl: string;
  private readonly sendReceipt: boolean;

  constructor(private readonly config: ConfigService) {
    this.shopId = this.config.get<string>('YOOKASSA_SHOP_ID', '');
    this.secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY', '');
    const configuredReturn =
      this.config.get<string>('YOOKASSA_RETURN_URL', '') ||
      'https://stopkek.site/api/payments/yookassa/return';
    // ЮKassa принимает только http(s) return_url; deep link — через наш redirect endpoint.
    this.returnUrl = configuredReturn.startsWith('stopkek://')
      ? 'https://stopkek.site/api/payments/yookassa/return'
      : configuredReturn;
    this.sendReceipt = this.config.get('YOOKASSA_SEND_RECEIPT') !== 'false';
  }

  get enabled() {
    return Boolean(this.shopId && this.secretKey);
  }

  buildReturnUrl(paymentId: string) {
    const sep = this.returnUrl.includes('?') ? '&' : '?';
    return `${this.returnUrl}${sep}paymentId=${encodeURIComponent(paymentId)}`;
  }

  async createTopupPayment(params: {
    amountRub: number;
    paymentId: string;
    userId: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
  }) {
    const idempotenceKey = randomUUID();
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');

    const body: Record<string, unknown> = {
      amount: {
        value: params.amountRub.toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: this.buildReturnUrl(params.paymentId),
      },
      description: 'Пополнение баланса stopkek',
      metadata: {
        paymentId: params.paymentId,
        userId: params.userId,
      },
    };

    if (this.sendReceipt) {
      if (!params.customerPhone && !params.customerEmail) {
        throw new BadRequestException(
          'Для чека ЮKassa нужен телефон или email пользователя'
        );
      }
      body.receipt = {
        customer: {
          ...(params.customerPhone ? { phone: params.customerPhone } : {}),
          ...(params.customerEmail ? { email: params.customerEmail } : {}),
        },
        items: [
          {
            description: 'Пополнение баланса stopkek',
            quantity: '1.00',
            amount: {
              value: params.amountRub.toFixed(2),
              currency: 'RUB',
            },
            vat_code: Number(this.config.get('YOOKASSA_VAT_CODE', '1')),
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
        tax_system_code: Number(this.config.get('YOOKASSA_TAX_SYSTEM_CODE', '2')),
      };
    }

    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as YooPaymentResponse & YooErrorResponse;
    if (!res.ok) {
      this.logger.warn(`YooKassa create failed: ${JSON.stringify(data)}`);
      throw new BadRequestException(this.formatYooError(data));
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

  private formatYooError(data: YooErrorResponse) {
    if (data.description) return data.description;
    if (data.code) return `ЮKassa: ${data.code}`;
    return 'Не удалось создать платёж в ЮKassa';
  }
}
