import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BookingsModule } from '../bookings/bookings.module';
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
  ],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminService, AdminJwtStrategy],
})
export class AdminModule {}
