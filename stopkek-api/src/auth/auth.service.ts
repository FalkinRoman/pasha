import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { isRateLimited, rateLimitRetrySec } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeCallCode, SmsRuService } from '../smsru/smsru.service';
import { CallRequestDto } from './dto/call-request.dto';
import { CallVerifyDto } from './dto/call-verify.dto';

type OtpSession = {
  phone: string;
  codeHash: string;
  exp: number;
  attempts: number;
  smsCallId?: string;
};

type AdminLoginCode = {
  phone: string;
  codeHash: string;
  exp: number;
};

const MAX_ATTEMPTS = 5;
const ADMIN_CODE_TTL_SEC = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly callSessions = new Map<string, OtpSession>();
  private readonly smsSessions = new Map<string, OtpSession>();
  private readonly adminCodesByPhone = new Map<string, AdminLoginCode>();
  private readonly lastRequestByPhone = new Map<string, number>();
  private readonly callInFlightByPhone = new Map<
    string,
    Promise<{
      sessionId: string;
      phone: string;
      expiresInSec: number;
      retryAfterSec: number;
      devCode?: string;
    }>
  >();
  private readonly mockCodes: Set<string>;
  private readonly reviewPhone: string;
  private readonly reviewCode: string;
  private readonly ttlSec: number;
  private readonly hmacSecret: string;
  private readonly isDev: boolean;
  private readonly phoneCooldownMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly smsRu: SmsRuService
  ) {
    const raw = this.config.get<string>('MOCK_CALL_CODES', '1234');
    this.mockCodes = new Set(raw.split(',').map((c) => c.trim()));
    const reviewPhone = this.config.get<string>('REVIEW_LOGIN_PHONE', '').trim();
    const reviewCode = this.config.get<string>('REVIEW_LOGIN_CODE', '').trim();
    this.reviewPhone = reviewPhone ? normalizePhone(reviewPhone) : '';
    this.reviewCode = reviewCode ? normalizeCallCode(reviewCode) : '';
    if (this.reviewPhone && this.reviewCode) {
      this.logger.log(`Apple/review login enabled for ${this.reviewPhone}`);
    }
    this.ttlSec = Number(this.config.get('CALL_CODE_TTL_SEC', 300));
    this.hmacSecret = this.config.get<string>('JWT_SECRET', 'dev-secret');
    this.isDev = this.config.get('NODE_ENV') !== 'production';
    const cooldownSec = Number(
      this.config.get('CALL_REQUEST_COOLDOWN_SEC', this.isDev ? 10 : 20)
    );
    this.phoneCooldownMs = cooldownSec * 1000;
  }

  async requestCall(dto: CallRequestDto, clientIp: string) {
    const phone = normalizePhone(dto.phone);
    const inflight = this.callInFlightByPhone.get(phone);
    if (inflight) return inflight;

    const promise = this.doRequestCall(phone, clientIp).finally(() => {
      this.callInFlightByPhone.delete(phone);
    });
    this.callInFlightByPhone.set(phone, promise);
    return promise;
  }

  private isReviewLogin(phone: string): boolean {
    if (!this.reviewPhone || !this.reviewCode) return false;
    return normalizePhone(phone) === this.reviewPhone;
  }

  private async doRequestCall(phone: string, clientIp: string) {
    const digits = phoneDigits(phone);

    if (this.isReviewLogin(phone)) {
      const sessionId = randomUUID();
      const code = this.reviewCode;
      this.callSessions.set(sessionId, {
        phone,
        codeHash: this.hashCode(code),
        exp: Date.now() + this.ttlSec * 1000,
        attempts: 0,
      });
      this.logger.log(`call/request review phone=${phone} (no SMS.ru)`);
      return {
        sessionId,
        phone,
        expiresInSec: this.ttlSec,
        retryAfterSec: Math.ceil(this.phoneCooldownMs / 1000),
      };
    }

    const last = this.lastRequestByPhone.get(phone);
    if (last && Date.now() - last < this.phoneCooldownMs) {
      const waitSec = Math.ceil((this.phoneCooldownMs - (Date.now() - last)) / 1000);
      throw new HttpException(
        { message: `Повторный звонок через ${waitSec} сек`, retryAfterSec: waitSec },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const sessionId = randomUUID();
    let code: string;
    let smsCallId: string | undefined;
    let devCode: string | undefined;

    this.logger.log(
      `call/request phone=${phone} smsru=${this.smsRu.enabled} clientIp=${clientIp}`
    );

    // Блокируем параллельные запросы до ответа SMS.ru
    this.lastRequestByPhone.set(phone, Date.now());

    try {
      if (this.smsRu.enabled) {
        const call = await this.smsRu.codeCall(digits, clientIp);
        code = call.code;
        smsCallId = call.callId;
        this.logger.log(`call/request OK callId=${smsCallId}`);
      } else if (this.isDev) {
        code = [...this.mockCodes][0] ?? '1234';
        devCode = code;
      } else {
        this.logger.error('call/request: SMSRU_API_ID не задан в production');
        throw new ServiceUnavailableException(
          'Вход по звонку временно недоступен. Обратитесь в поддержку.'
        );
      }
    } catch (e) {
      this.lastRequestByPhone.delete(phone);
      throw e;
    }

    this.callSessions.set(sessionId, {
      phone,
      codeHash: this.hashCode(code),
      exp: Date.now() + this.ttlSec * 1000,
      attempts: 0,
      smsCallId,
    });

    return {
      sessionId,
      phone,
      expiresInSec: this.ttlSec,
      retryAfterSec: Math.ceil(this.phoneCooldownMs / 1000),
      ...(devCode ? { devCode } : {}),
    };
  }

  async requestSms(dto: CallRequestDto) {
    const phone = normalizePhone(dto.phone);
    const digits = phoneDigits(phone);

    const last = this.lastRequestByPhone.get(phone);
    if (last && Date.now() - last < this.phoneCooldownMs) {
      const waitSec = Math.ceil((this.phoneCooldownMs - (Date.now() - last)) / 1000);
      throw new HttpException(
        { message: `Повторная SMS через ${waitSec} сек`, retryAfterSec: waitSec },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const sessionId = randomUUID();
    const code = String(randomInt(1000, 10000));
    let devCode: string | undefined;

    this.logger.log(`sms/request phone=${phone} smsru=${this.smsRu.enabled}`);

    if (this.smsRu.enabled) {
      await this.smsRu.sendOtp(digits, code);
    } else if (this.isDev) {
      devCode = code;
    } else {
      throw new ServiceUnavailableException(
        'Вход по SMS временно недоступен. Используйте вход по звонку.'
      );
    }

    this.smsSessions.set(sessionId, {
      phone,
      codeHash: this.hashCode(code),
      exp: Date.now() + this.ttlSec * 1000,
      attempts: 0,
    });
    this.lastRequestByPhone.set(phone, Date.now());

    return {
      sessionId,
      phone,
      expiresInSec: this.ttlSec,
      retryAfterSec: Math.ceil(this.phoneCooldownMs / 1000),
      ...(devCode ? { devCode } : {}),
    };
  }

  async verifyCall(dto: CallVerifyDto) {
    return this.verifyOtp(dto, this.callSessions);
  }

  async verifySms(dto: CallVerifyDto) {
    return this.verifyOtp(dto, this.smsSessions);
  }

  private async verifyOtp(dto: CallVerifyDto, store: Map<string, OtpSession>) {
    const phone = normalizePhone(dto.phone);
    const code = normalizeCallCode(dto.code);

    // Brute-force защита: на номер, поверх per-session attempts
    if (isRateLimited(`otp-verify:${phone}`, 15, 15 * 60_000)) {
      const retry = rateLimitRetrySec(`otp-verify:${phone}`, 15 * 60_000);
      throw new HttpException(
        { message: `Слишком много попыток. Повторите через ${Math.ceil(retry / 60)} мин`, retryAfterSec: retry },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (dto.sessionId) {
      const session = store.get(dto.sessionId);
      if (session && session.phone === phone) {
        if (session.exp < Date.now()) {
          store.delete(dto.sessionId);
        } else {
          session.attempts += 1;
          if (session.attempts > MAX_ATTEMPTS) {
            store.delete(dto.sessionId);
            throw new HttpException('Слишком много попыток', HttpStatus.TOO_MANY_REQUESTS);
          }
          if (this.codesMatch(session.codeHash, code)) {
            store.delete(dto.sessionId);
            this.adminCodesByPhone.delete(phone);
            return this.finishLogin(phone);
          }
        }
      }
    }

    if (this.tryAdminLoginCode(phone, code)) {
      this.adminCodesByPhone.delete(phone);
      if (dto.sessionId) store.delete(dto.sessionId);
      return this.finishLogin(phone);
    }

    if (this.isReviewLogin(phone) && normalizeCallCode(code) === this.reviewCode) {
      if (dto.sessionId) store.delete(dto.sessionId);
      return this.finishLogin(phone);
    }

    throw new UnauthorizedException('Неверный код или срок истёк');
  }

  issueAdminLoginCode(phone: string) {
    const normalized = normalizePhone(phone);
    const code = String(randomInt(1000, 10000));
    this.adminCodesByPhone.set(normalized, {
      phone: normalized,
      codeHash: this.hashCode(code),
      exp: Date.now() + ADMIN_CODE_TTL_SEC * 1000,
    });
    return {
      phone: normalized,
      code,
      expiresInSec: ADMIN_CODE_TTL_SEC,
    };
  }

  private tryAdminLoginCode(phone: string, code: string): boolean {
    const entry = this.adminCodesByPhone.get(phone);
    if (!entry || entry.phone !== phone) return false;
    if (entry.exp < Date.now()) {
      this.adminCodesByPhone.delete(phone);
      return false;
    }
    return this.codesMatch(entry.codeHash, code);
  }

  private hashCode(code: string): string {
    const normalized = normalizeCallCode(code);
    return createHmac('sha256', this.hmacSecret).update(normalized).digest('hex');
  }

  private codesMatch(storedHash: string, code: string): boolean {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(this.hashCode(code), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private async finishLogin(phone: string) {
    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNew = !user;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          name: '',
          profileCompleted: false,
          wallet: { create: { balance: 0 } },
        },
      });
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId: user.id } });
    const tokens = await this.issueTokens(user.id, phone);

    return {
      status: 'confirmed' as const,
      isNew,
      needsProfileSetup: !user.profileCompleted,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name || 'Игрок',
        balance: wallet?.balance ?? 0,
        balanceRub: Math.round((wallet?.balance ?? 0) / 100),
        profileCompleted: user.profileCompleted,
        identityStatus: user.identityStatus,
        identityVerified: ['approved', 'auto_approved'].includes(
          user.identityStatus
        ),
      },
      ...tokens,
    };
  }

  /** Обмен refresh-токена на новую пару */
  async refresh(refreshToken: string) {
    let payload: { sub: string; phone: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Сессия истекла, войдите снова');
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Неверный токен');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return this.issueTokens(user.id, user.phone);
  }

  private async issueTokens(userId: string, phone: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, phone, typ: 'user' as const },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
      }
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, phone, typ: 'refresh' as const },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL', '30d'),
      }
    );
    return { accessToken, refreshToken, tokenType: 'Bearer' };
  }
}

export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) return '+7' + d.slice(1);
  if (d.length === 11 && d.startsWith('7')) return '+' + d;
  if (d.length === 10) return '+7' + d;
  return phone.startsWith('+') ? phone : '+' + d;
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** SMS.ru не принимает LAN/private IP — для dev и Expo Go передаём -1 */
export function resolveClientIp(ip?: string): string {
  if (!ip) return '-1';
  let normalized = ip.trim();
  if (normalized.startsWith('::ffff:')) normalized = normalized.slice(7);

  if (
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized === 'localhost' ||
    isPrivateIp(normalized)
  ) {
    return '-1';
  }
  return normalized;
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}
