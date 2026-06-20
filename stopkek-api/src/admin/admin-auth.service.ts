import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { isRateLimited, rateLimitRetrySec } from '../common/rate-limit';
import { AdminJwtPayload } from './admin-jwt.strategy';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService
  ) {}

  private adminJwtSecret() {
    return (
      this.config.get<string>('JWT_ADMIN_SECRET') ||
      this.config.get<string>('JWT_SECRET')
    );
  }

  async login(dto: AdminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    if (isRateLimited(`admin-login:${email}`, 8, 15 * 60_000)) {
      const wait = rateLimitRetrySec(`admin-login:${email}`, 15 * 60_000);
      throw new HttpException(
        `Слишком много попыток. Повторите через ${wait} сек`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(dto.password, admin.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const payload: AdminJwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      typ: 'admin',
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.adminJwtSecret(),
      expiresIn: this.config.get('JWT_ADMIN_TTL', '12h'),
    });

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async me(adminId: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException();
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
  }

  /** Всегда один ответ — не палим, есть ли email в базе */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    if (isRateLimited(`admin-forgot:${email}`, 5, 60 * 60_000)) {
      return {
        ok: true,
        message:
          'Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.',
      };
    }
    const admin = await this.prisma.admin.findUnique({ where: { email } });

    if (admin) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.adminPasswordReset.create({
        data: { adminId: admin.id, tokenHash, expiresAt },
      });

      const baseUrl = this.config
        .get<string>('ADMIN_APP_URL', 'http://localhost:5173')
        .replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      const sent = await this.mail.sendPasswordReset(admin.email, resetUrl);
      if (sent.dev) {
        this.logger.log(`Password reset link for ${email}: ${resetUrl}`);
      }
    }

    return {
      ok: true,
      message:
        'Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const row = await this.prisma.adminPasswordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!row) {
      throw new BadRequestException('Ссылка недействительна или истекла');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id: row.adminId },
        data: { passwordHash },
      }),
      this.prisma.adminPasswordReset.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.adminPasswordReset.updateMany({
        where: { adminId: row.adminId, usedAt: null, id: { not: row.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'Пароль обновлён. Можно войти.' };
  }
}
