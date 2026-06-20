import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ClubModule } from './club/club.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { IdentityModule } from './identity/identity.module';
import { FeedbackModule } from './feedback/feedback.module';
import { KioskModule } from './kiosk/kiosk.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ClubModule,
    UsersModule,
    IdentityModule,
    BookingsModule,
    KioskModule,
    WalletModule,
    FeedbackModule,
    AdminModule,
    SchedulerModule,
  ],
})
export class AppModule {}
