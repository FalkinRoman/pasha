import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentSettingsService } from '../payments/payment-settings.service';
import { YooKassaService } from '../payments/yookassa.service';
import { PrismaService } from '../prisma/prisma.service';

type YooKassaWebhookBody = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    metadata?: { paymentId?: string; userId?: string };
  };
};

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaService,
    private readonly paymentSettings: PaymentSettingsService
  ) {}

  getConfig() {
    return this.paymentSettings.resolveWalletConfig();
  }

  async getTransactions(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Кошелёк не найден');

    const rows = await this.prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((t) => ({
      id: t.id,
      type: t.type,
      amountRub: Math.round(t.amount / 100),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /** Создать платёж YooKassa (редирект на оплату) */
  async createTopup(userId: string, amountRub: number) {
    const cfg = await this.paymentSettings.resolveWalletConfig();
    if (!cfg.yookassaEnabled) {
      throw new BadRequestException(
        'Оплата картой недоступна. Используйте тестовое пополнение или обратитесь в поддержку.'
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const kopecks = amountRub * 100;
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: kopecks,
        provider: 'yookassa',
        status: 'pending',
      },
    });

    let yoo: Awaited<ReturnType<YooKassaService['createTopupPayment']>>;
    try {
      yoo = await this.yookassa.createTopupPayment({
        amountRub,
        paymentId: payment.id,
        userId,
        customerPhone: user?.phone,
        customerEmail: user?.email,
      });
    } catch (e) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      throw e;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerId: yoo.providerId,
        confirmationUrl: yoo.confirmationUrl,
      },
    });

    return {
      mode: 'yookassa' as const,
      paymentId: payment.id,
      amountRub,
      confirmationUrl: yoo.confirmationUrl,
      status: yoo.status,
    };
  }

  /** Тестовое пополнение без списания */
  async mockTopup(userId: string, amountRub: number) {
    const cfg = await this.paymentSettings.resolveWalletConfig();
    if (!cfg.mockTopupEnabled) {
      throw new ForbiddenException('Тестовое пополнение отключено');
    }

    const kopecks = amountRub * 100;
    const wallet = await this.ensureWallet(userId);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: kopecks,
        provider: 'mock',
        status: 'succeeded',
        paidAt: new Date(),
      },
    });

    const updated = await this.creditWallet(
      wallet.id,
      kopecks,
      payment.id,
      'Тестовое пополнение баланса'
    );

    return {
      mode: 'mock' as const,
      paymentId: payment.id,
      amountRub,
      balanceRub: Math.round(updated.balance / 100),
    };
  }

  async getTopupStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Платёж не найден');

    if (
      payment.provider === 'yookassa' &&
      payment.providerId &&
      payment.status === 'pending' &&
      this.yookassa.enabled
    ) {
      const remote = await this.yookassa.fetchPayment(payment.providerId);
      if (remote.status === 'succeeded') {
        await this.completePayment(payment.id);
        const refreshed = await this.prisma.payment.findUnique({
          where: { id: paymentId },
        });
        return this.paymentStatusDto(refreshed!, userId);
      }
    }

    return this.paymentStatusDto(payment, userId);
  }

  async handleYookassaWebhook(body: YooKassaWebhookBody) {
    if (body.event !== 'payment.succeeded' || body.object?.status !== 'succeeded') {
      return { ok: true };
    }

    const paymentId = body.object.metadata?.paymentId;
    const providerId = body.object.id;

    const payment = paymentId
      ? await this.prisma.payment.findUnique({ where: { id: paymentId } })
      : providerId
        ? await this.prisma.payment.findFirst({ where: { providerId } })
        : null;

    if (payment && payment.status !== 'succeeded') {
      await this.completePayment(payment.id);
    }

    return { ok: true };
  }

  async completePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === 'succeeded') return;

    const wallet = await this.ensureWallet(payment.userId);
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'succeeded', paidAt: new Date() },
    });
    await this.creditWallet(
      wallet.id,
      payment.amount,
      paymentId,
      'Пополнение через YooKassa'
    );
  }

  private async creditWallet(
    walletId: string,
    kopecks: number,
    externalId: string,
    description: string
  ) {
    const existing = await this.prisma.transaction.findFirst({
      where: { externalId },
    });
    if (existing) {
      return this.prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    }

    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: kopecks } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId,
          type: 'topup',
          amount: kopecks,
          description,
          externalId,
        },
      }),
    ]);

    return this.prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
  }

  private async ensureWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId, balance: 0 } });
    }
    return wallet;
  }

  private async paymentStatusDto(
    payment: { id: string; status: PaymentStatus; amount: number },
    userId: string
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      paymentId: payment.id,
      status: payment.status,
      amountRub: Math.round(payment.amount / 100),
      balanceRub: Math.round((wallet?.balance ?? 0) / 100),
    };
  }
}
