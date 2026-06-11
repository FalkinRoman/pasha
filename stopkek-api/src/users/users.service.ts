import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
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
    if (!user) throw new NotFoundException('Пользователь не найден');
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
   * Полное удаление аккаунта и данных (152-ФЗ, App Store 5.1.1(v)).
   * Связанные записи снимает Prisma onDelete: Cascade.
   */
  async deleteAccount(userId: string) {
    const ongoing = await this.prisma.booking.findFirst({
      where: { userId, status: { in: ['paid', 'active', 'pending_payment'] } },
      select: { id: true },
    });
    if (ongoing) {
      throw new BadRequestException(
        'Сначала завершите или отмените активную бронь, затем удалите аккаунт'
      );
    }

    const verifications = await this.prisma.identityVerification.findMany({
      where: { userId },
      select: { photoPath: true },
    });

    await this.prisma.user.delete({ where: { id: userId } });

    for (const v of verifications) {
      if (!v.photoPath) continue;
      unlink(v.photoPath).catch(() => {});
    }

    this.logger.log(`account deleted userId=${userId}`);
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
