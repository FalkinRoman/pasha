import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type AdminJwtPayload = {
  sub: string;
  email: string;
  role: string;
  typ: 'admin';
};

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: AdminJwtPayload) {
    if (payload.typ !== 'admin') {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return { adminId: payload.sub, email: payload.email, role: payload.role };
  }
}
