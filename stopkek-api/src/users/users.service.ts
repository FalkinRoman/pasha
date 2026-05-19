import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  private toPublic(user: {
    id: string;
    phone: string;
    name: string;
    profileCompleted: boolean;
    wallet: { balance: number } | null;
  }) {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name || 'Игрок',
      balance: user.wallet?.balance ?? 0, // копейки
      balanceRub: Math.round((user.wallet?.balance ?? 0) / 100),
      profileCompleted: user.profileCompleted,
    };
  }
}
