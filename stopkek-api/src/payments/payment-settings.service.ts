import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { YooKassaService } from './yookassa.service';

export type WalletPaymentConfig = {
  yookassaEnabled: boolean;
  mockTopupEnabled: boolean;
  yookassaConfigured: boolean;
  currency: 'RUB';
  minTopupRub: number;
  minMockTopupRub: number;
  maxTopupRub: number;
};

@Injectable()
export class PaymentSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaService,
    private readonly config: ConfigService
  ) {}

  async resolveWalletConfig(): Promise<WalletPaymentConfig> {
    const club = await this.prisma.club.findFirst();
    const yookassaConfigured = this.yookassa.enabled;
    const clubYookassa = club?.yookassaEnabled ?? true;
    const clubMock = club?.mockTopupEnabled ?? false;
    const envMock = this.config.get('WALLET_MOCK_TOPUP') === 'true';
    const isDev = this.config.get('NODE_ENV') !== 'production';

    const yookassaEnabled = yookassaConfigured && clubYookassa;
    const mockTopupEnabled =
      clubMock || (envMock && !yookassaEnabled) || (isDev && !yookassaConfigured);

    const minTopupRub = Math.max(
      1,
      Number(this.config.get('WALLET_TOPUP_MIN_RUB', '10')) || 10
    );
    const minMockTopupRub = Math.max(
      1,
      Number(this.config.get('WALLET_TOPUP_MIN_MOCK_RUB', '1')) || 1
    );
    const maxTopupRub = Math.max(
      minTopupRub,
      Number(this.config.get('WALLET_TOPUP_MAX_RUB', '100000')) || 100_000
    );

    return {
      yookassaEnabled,
      mockTopupEnabled,
      yookassaConfigured,
      currency: 'RUB',
      minTopupRub,
      minMockTopupRub,
      maxTopupRub,
    };
  }

  async getClubPaymentSettings() {
    const club = await this.prisma.club.findFirst();
    const resolved = await this.resolveWalletConfig();
    return {
      yookassaEnabled: club?.yookassaEnabled ?? true,
      mockTopupEnabled: club?.mockTopupEnabled ?? false,
      yookassaConfigured: resolved.yookassaConfigured,
      effectiveYookassaEnabled: resolved.yookassaEnabled,
      effectiveMockTopupEnabled: resolved.mockTopupEnabled,
    };
  }

  async updateClubPaymentSettings(data: {
    yookassaEnabled?: boolean;
    mockTopupEnabled?: boolean;
  }) {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new Error('Клуб не найден');

    const update: { yookassaEnabled?: boolean; mockTopupEnabled?: boolean } = {};
    if (data.yookassaEnabled !== undefined) update.yookassaEnabled = data.yookassaEnabled;
    if (data.mockTopupEnabled !== undefined) update.mockTopupEnabled = data.mockTopupEnabled;

    await this.prisma.club.update({ where: { id: club.id }, data: update });
    return this.getClubPaymentSettings();
  }
}
