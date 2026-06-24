import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { deriveSeatKey, safeEqual } from './kiosk-keys';

@Injectable()
export class KioskGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const provided = String(req.headers['x-kiosk-key'] ?? '').trim();
    const master = this.config.get<string>('KIOSK_API_KEY', '').trim();

    if (!master || !provided) {
      throw new UnauthorizedException('Неверный ключ киоска');
    }

    // Legacy / global key (kept for backward compat; disable with KIOSK_ALLOW_GLOBAL_KEY=false).
    const allowGlobal =
      this.config.get<string>('KIOSK_ALLOW_GLOBAL_KEY', 'true') !== 'false';
    if (allowGlobal && safeEqual(provided, master)) {
      return true;
    }

    // Per-seat key: HMAC(master, seat). Bound to the seat in the request, so a
    // leaked key cannot act for another PC.
    const seatNumber = this.extractSeatNumber(req);
    if (seatNumber !== null) {
      const expected = deriveSeatKey(master, seatNumber);
      if (safeEqual(provided, expected)) {
        return true;
      }
    }

    throw new UnauthorizedException('Неверный ключ киоска');
  }

  private extractSeatNumber(req: Request): number | null {
    const raw =
      (req.query?.['seatNumber'] as string | undefined) ??
      (req.body?.seatNumber as number | string | undefined);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }
}
