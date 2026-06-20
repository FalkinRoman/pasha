import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityStatus } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const VERIFIED: IdentityStatus[] = ['approved', 'auto_approved'];

@Injectable()
export class IdentityService {
  private readonly uploadRoot: string;
  private readonly autoApproveMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    this.uploadRoot = join(process.cwd(), 'uploads', 'verifications');
    const min = Number(config.get('IDENTITY_AUTO_APPROVE_MIN', 5));
    this.autoApproveMs = min * 60 * 1000;
  }

  async processAutoApprovals() {
    const now = new Date();
    const due = await this.prisma.identityVerification.findMany({
      where: { status: 'pending', autoApproveAt: { lte: now } },
    });
    for (const v of due) {
      await this.resolveVerification(v.id, 'auto_approved', null, null);
    }
    return due.length;
  }

  async getStatus(userId: string) {
    await this.processAutoApprovals();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const latest = await this.prisma.identityVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    const now = Date.now();
    let secondsUntilAutoApprove: number | null = null;
    if (user.identityStatus === 'pending' && latest) {
      secondsUntilAutoApprove = Math.max(
        0,
        Math.ceil((latest.autoApproveAt.getTime() - now) / 1000)
      );
    }

    return {
      status: user.identityStatus,
      canBook: VERIFIED.includes(user.identityStatus),
      rejectReason: latest?.rejectReason ?? null,
      submittedAt: latest?.submittedAt?.toISOString() ?? null,
      autoApproveAt: latest?.autoApproveAt?.toISOString() ?? null,
      secondsUntilAutoApprove,
      verificationId: latest?.id ?? null,
    };
  }

  async submit(
    userId: string,
    file: Express.Multer.File,
    pdConsent: boolean
  ) {
    if (!pdConsent) {
      throw new BadRequestException('Нужно согласие на обработку персональных данных');
    }

    await this.processAutoApprovals();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (VERIFIED.includes(user.identityStatus)) {
      throw new BadRequestException('Верификация уже пройдена');
    }

    const pending = await this.prisma.identityVerification.findFirst({
      where: { userId, status: 'pending' },
    });
    if (pending) {
      throw new BadRequestException(
        'Заявка уже на проверке. Дождитесь ответа или автоподтверждения.'
      );
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Загрузите фото с паспортом');
    }

    await mkdir(this.uploadRoot, { recursive: true });
    const filename = `${userId}-${Date.now()}.jpg`;
    const photoPath = join('verifications', filename);
    await writeFile(join(this.uploadRoot, filename), file.buffer);

    const now = new Date();
    const autoApproveAt = new Date(now.getTime() + this.autoApproveMs);
    const consentAt = now;

    const verification = await this.prisma.$transaction(async (tx) => {
      const v = await tx.identityVerification.create({
        data: {
          userId,
          status: 'pending',
          photoPath,
          pdConsentAt: consentAt,
          autoApproveAt,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { identityStatus: 'pending', pdConsentAt: consentAt },
      });
      return v;
    });

    return {
      verificationId: verification.id,
      status: 'pending' as const,
      autoApproveAt: autoApproveAt.toISOString(),
      secondsUntilAutoApprove: Math.ceil(this.autoApproveMs / 1000),
    };
  }

  assertCanBook(status: IdentityStatus) {
    if (!VERIFIED.includes(status)) {
      throw new BadRequestException(
        'Нужна верификация по паспорту. Пройдите проверку в приложении.'
      );
    }
  }

  getPhotoAbsolutePath(photoPath: string) {
    return join(process.cwd(), 'uploads', photoPath);
  }

  async listPendingForAdmin() {
    await this.processAutoApprovals();
    const list = await this.prisma.identityVerification.findMany({
      where: { status: 'pending' },
      orderBy: { submittedAt: 'asc' },
      include: {
        user: { select: { id: true, phone: true, name: true } },
      },
    });
    const now = Date.now();
    return list.map((v) => ({
      id: v.id,
      userId: v.userId,
      userPhone: v.user.phone,
      userName: v.user.name || 'Игрок',
      status: v.status,
      submittedAt: v.submittedAt,
      autoApproveAt: v.autoApproveAt,
      secondsUntilAutoApprove: Math.max(
        0,
        Math.ceil((v.autoApproveAt.getTime() - now) / 1000)
      ),
      photoUrl: `/admin/verifications/${v.id}/photo`,
    }));
  }

  async approve(verificationId: string, adminId: string) {
    const v = await this.findPendingOrThrow(verificationId);
    await this.resolveVerification(v.id, 'approved', adminId, new Date());
    return { ok: true };
  }

  async reject(verificationId: string, adminId: string, reason: string) {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException('Укажите причину отклонения');
    }
    const v = await this.findPendingOrThrow(verificationId);
    await this.prisma.$transaction(async (tx) => {
      await tx.identityVerification.update({
        where: { id: v.id },
        data: {
          status: 'rejected',
          rejectReason: trimmed,
          resolvedAt: new Date(),
          resolvedByAdminId: adminId,
        },
      });
      await tx.user.update({
        where: { id: v.userId },
        data: { identityStatus: 'rejected' },
      });
    });
    return { ok: true };
  }

  private async findPendingOrThrow(id: string) {
    const v = await this.prisma.identityVerification.findUnique({
      where: { id },
    });
    if (!v) throw new NotFoundException('Заявка не найдена');
    if (v.status !== 'pending') {
      throw new BadRequestException('Заявка уже обработана');
    }
    return v;
  }

  private async resolveVerification(
    verificationId: string,
    status: 'approved' | 'auto_approved',
    adminId: string | null,
    resolvedAt: Date | null
  ) {
    const v = await this.prisma.identityVerification.findUnique({
      where: { id: verificationId },
    });
    if (!v || v.status !== 'pending') return;

    const at = resolvedAt ?? new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.identityVerification.update({
        where: { id: verificationId },
        data: {
          status,
          resolvedAt: at,
          resolvedByAdminId: adminId ?? undefined,
        },
      });
      await tx.user.update({
        where: { id: v.userId },
        data: { identityStatus: status },
      });
    });
  }
}
