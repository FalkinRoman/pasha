import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return this.toPublic(user);
  }

  async updateProfile(userId: string, name: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: name.trim(), profileCompleted: true },
      include: { wallet: true },
    });
    return this.toPublic(user);
  }

  /**
   * Soft delete (App Store 5.1.1(v)): для пользователя аккаунт удалён,
   * данные (транзакции, брони, фото верификации) сохраняются для отчётности
   * и безопасности. Номер освобождается — повторная регистрация создаст
   * нового пользователя с чистым профилем.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('Пользователь не найден');
    }

    const ongoing = await this.prisma.booking.findFirst({
      where: { userId, status: { in: ['paid', 'active', 'pending_payment'] } },
      select: { id: true },
    });
    if (ongoing) {
      throw new BadRequestException(
        'Сначала завершите или отмените активную бронь, затем удалите аккаунт'
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          deletedPhone: user.phone,
          // освобождаем номер для повторной регистрации (phone уникален)
          phone: `deleted:${Date.now()}:${user.phone}`,
        },
      }),
      this.prisma.pushToken.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`account soft-deleted userId=${userId} phone=${user.phone}`);
    return { ok: true };
  }

  registerPushToken(userId: string, token: string, platform: string) {
    return this.notifications.registerToken(userId, token, platform);
  }

  getNotificationPrefs(userId: string) {
    return this.notifications.getPrefs(userId);
  }

  updateNotificationPrefs(
    userId: string,
    prefs: { session?: boolean; remind?: boolean; promo?: boolean }
  ) {
    return this.notifications.updatePrefs(userId, prefs);
  }

  private toPublic(user: {
    id: string;
    phone: string;
    name: string;
    profileCompleted: boolean;
    identityStatus: string;
    notifySession: boolean;
    notifyRemind15: boolean;
    notifyPromo: boolean;
    wallet: { balance: number } | null;
  }) {
    const verified = ['approved', 'auto_approved'].includes(user.identityStatus);
    return {
      id: user.id,
      phone: user.phone,
      name: user.name || 'Игрок',
      balance: user.wallet?.balance ?? 0, // копейки
      balanceRub: Math.round((user.wallet?.balance ?? 0) / 100),
      profileCompleted: user.profileCompleted,
      identityStatus: user.identityStatus,
      identityVerified: verified,
      notifications: {
        session: user.notifySession,
        remind: user.notifyRemind15,
        promo: user.notifyPromo,
      },
    };
  }
}
