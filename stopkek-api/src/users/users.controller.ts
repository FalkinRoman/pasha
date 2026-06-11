import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationPrefsDto } from './dto/notification-prefs.dto';
import { PushTokenDto } from './dto/push-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() u: { userId: string }) {
    return this.users.getMe(u.userId);
  }

  @Patch('me')
  update(@CurrentUser() u: { userId: string }, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(u.userId, dto.name);
  }

  /** Удаление аккаунта (App Store Guideline 5.1.1(v)) */
  @Delete('me')
  deleteAccount(@CurrentUser() u: { userId: string }) {
    return this.users.deleteAccount(u.userId);
  }

  @Post('me/push-token')
  pushToken(@CurrentUser() u: { userId: string }, @Body() dto: PushTokenDto) {
    return this.users.registerPushToken(u.userId, dto.token, dto.platform);
  }

  @Get('me/notifications')
  notificationPrefs(@CurrentUser() u: { userId: string }) {
    return this.users.getNotificationPrefs(u.userId);
  }

  @Patch('me/notifications')
  updateNotificationPrefs(
    @CurrentUser() u: { userId: string },
    @Body() dto: NotificationPrefsDto
  ) {
    return this.users.updateNotificationPrefs(u.userId, dto);
  }
}
