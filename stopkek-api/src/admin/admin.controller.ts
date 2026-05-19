import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admin: AdminService
  ) {}

  @Post('auth/login')
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto);
  }

  @Post('auth/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('auth/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get('auth/me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() a: { adminId: string }) {
    return this.auth.me(a.adminId);
  }

  @Get('dashboard')
  @UseGuards(AdminJwtGuard)
  dashboard() {
    return this.admin.getDashboard();
  }

  @Get('seats')
  @UseGuards(AdminJwtGuard)
  seats() {
    return this.admin.listSeats();
  }

  @Patch('seats/:id')
  @UseGuards(AdminJwtGuard)
  updateSeat(@Param('id') id: string, @Body() dto: UpdateSeatDto) {
    return this.admin.updateSeat(id, dto);
  }

  @Get('zones')
  @UseGuards(AdminJwtGuard)
  zones() {
    return this.admin.listZones();
  }

  @Patch('zones/:id')
  @UseGuards(AdminJwtGuard)
  updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.admin.updateZone(id, dto);
  }

  @Get('bookings')
  @UseGuards(AdminJwtGuard)
  bookings(@Query('status') status?: BookingStatus) {
    return this.admin.listBookings(status);
  }

  @Post('bookings/:id/cancel')
  @UseGuards(AdminJwtGuard)
  cancelBooking(@Param('id') id: string) {
    return this.admin.cancelBooking(id);
  }

  @Get('users')
  @UseGuards(AdminJwtGuard)
  users(@Query('search') search?: string) {
    return this.admin.listUsers(search);
  }

  @Get('users/:id')
  @UseGuards(AdminJwtGuard)
  user(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users/:id/wallet/adjust')
  @UseGuards(AdminJwtGuard)
  adjustWallet(@Param('id') id: string, @Body() dto: WalletAdjustDto) {
    return this.admin.adjustWallet(id, dto);
  }

  @Get('transactions')
  @UseGuards(AdminJwtGuard)
  transactions() {
    return this.admin.listTransactions();
  }

  @Get('feedback')
  @UseGuards(AdminJwtGuard)
  feedback() {
    return this.admin.listFeedback();
  }
}
