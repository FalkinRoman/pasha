import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ClubModule } from '../club/club.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.register({}),
    BookingsModule,
    IdentityModule,
    ClubModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminService, AdminJwtStrategy],
})
export class AdminModule {}
