import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class KioskGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = req.headers['x-kiosk-key'];
    const expected = this.config.get<string>('KIOSK_API_KEY', '').trim();
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Неверный ключ киоска');
    }
    return true;
  }
}
