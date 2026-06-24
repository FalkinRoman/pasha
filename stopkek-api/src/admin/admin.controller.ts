import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { BookingStatus } from '@prisma/client';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateSeatDto } from './dto/create-seat.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { ConfigService } from '@nestjs/config';
import { ClubService } from '../club/club.service';
import { LocksService } from '../locks/locks.service';
import { KioskTelemetryService } from '../kiosk/kiosk-telemetry.service';
import { deriveSeatKey } from '../kiosk/kiosk-keys';
import { UpdateClubLocksDto } from './dto/update-club-locks.dto';
import { UpsertDurationPackageDto } from './dto/upsert-duration-package.dto';
import { UpsertNightPricingDto } from './dto/upsert-night-pricing.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admin: AdminService,
    private readonly club: ClubService,
    private readonly locks: LocksService,
    private readonly kioskTelemetry: KioskTelemetryService,
    private readonly config: ConfigService
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

  // --- Kiosk (club PCs) -------------------------------------------------
  @Get('kiosk/devices')
  @UseGuards(AdminJwtGuard)
  kioskDevices() {
    return this.kioskTelemetry.list();
  }

  /** Per-seat kiosk key to put in that PC's config.json (HMAC of the master key). */
  @Get('kiosk/seat-key')
  @UseGuards(AdminJwtGuard)
  kioskSeatKey(@Query('seatNumber') seatNumber: string) {
    const n = Number(seatNumber);
    if (!Number.isFinite(n) || n < 1) {
      return { error: 'seatNumber required' };
    }
    const master = this.config.get<string>('KIOSK_API_KEY', '').trim();
    return { seatNumber: n, key: master ? deriveSeatKey(master, n) : null };
  }

  @Post('seats')
  @UseGuards(AdminJwtGuard)
  createSeat(@Body() dto: CreateSeatDto) {
    return this.admin.createSeat(dto);
  }

  @Patch('seats/:id')
  @UseGuards(AdminJwtGuard)
  updateSeat(@Param('id') id: string, @Body() dto: UpdateSeatDto) {
    return this.admin.updateSeat(id, dto);
  }

  @Delete('seats/:id')
  @UseGuards(AdminJwtGuard)
  deleteSeat(@Param('id') id: string) {
    return this.admin.deleteSeat(id);
  }

  @Get('zones')
  @UseGuards(AdminJwtGuard)
  zones() {
    return this.admin.listZones();
  }

  @Post('zones')
  @UseGuards(AdminJwtGuard)
  createZone(@Body() dto: CreateZoneDto) {
    return this.admin.createZone(dto);
  }

  @Patch('zones/:id')
  @UseGuards(AdminJwtGuard)
  updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.admin.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @UseGuards(AdminJwtGuard)
  deleteZone(@Param('id') id: string) {
    return this.admin.deleteZone(id);
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

  @Post('users/:id/login-code')
  @UseGuards(AdminJwtGuard)
  generateLoginCode(@Param('id') id: string) {
    return this.admin.generateUserLoginCode(id);
  }

  @Get('club')
  @UseGuards(AdminJwtGuard)
  getClubSettings() {
    return this.club.getClubSettings();
  }

  @Patch('club')
  @UseGuards(AdminJwtGuard)
  updateClubSettings(@Body() dto: UpdateClubDto) {
    return this.club.updateClubSettings(dto);
  }

  @Post('club/image')
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  uploadClubImage(@UploadedFile() file: Express.Multer.File) {
    return this.club.uploadClubImage(file);
  }

  @Get('club/locks')
  @UseGuards(AdminJwtGuard)
  getClubLocks() {
    return this.locks.getClubLockConfig();
  }

  @Patch('club/locks')
  @UseGuards(AdminJwtGuard)
  updateClubLocks(@Body() dto: UpdateClubLocksDto) {
    return this.locks.updateClubLockConfig(dto);
  }

  @Get('locks/events')
  @UseGuards(AdminJwtGuard)
  lockEvents() {
    return this.locks.listEvents(80);
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

  @Get('verifications')
  @UseGuards(AdminJwtGuard)
  verifications() {
    return this.admin.listVerifications();
  }

  @Get('verifications/:id/photo')
  @UseGuards(AdminJwtGuard)
  verificationPhoto(@Param('id') id: string, @Res() res: Response) {
    return this.admin.streamVerificationPhoto(id, res);
  }

  @Post('verifications/:id/approve')
  @UseGuards(AdminJwtGuard)
  approveVerification(
    @Param('id') id: string,
    @CurrentAdmin() a: { adminId: string }
  ) {
    return this.admin.approveVerification(id, a.adminId);
  }

  @Get('access-logs')
  @UseGuards(AdminJwtGuard)
  accessLogs(
    @Query('seatNumber') seatNumber?: string,
    @Query('cellLock') cellLock?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string
  ) {
    return this.admin.listLockerLogs({
      seatNumber: seatNumber ? Number(seatNumber) : undefined,
      cellLock,
      limit: limit ? Number(limit) : undefined,
      types: types?.split(',').map((t) => t.trim()).filter(Boolean),
    });
  }

  /** @deprecated use GET /admin/access-logs */
  @Get('cell-control')
  @UseGuards(AdminJwtGuard)
  cellControl(
    @Query('seatNumber') seatNumber?: string,
    @Query('cellLock') cellLock?: string,
    @Query('limit') limit?: string
  ) {
    return this.admin.listLockerLogs({
      seatNumber: seatNumber ? Number(seatNumber) : undefined,
      cellLock,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('access-logs/purge-legacy')
  @UseGuards(AdminJwtGuard)
  purgeAccessLogs() {
    return this.admin.purgeAccessLogs();
  }

  @Get('cell-control/:id/photo')
  @UseGuards(AdminJwtGuard)
  cellControlPhoto(@Param('id') id: string, @Res() res: Response) {
    return this.admin.streamLockerPhoto(id, res);
  }

  @Get('acceptance-reports')
  @UseGuards(AdminJwtGuard)
  acceptanceReports(@Query('resolved') resolved?: string) {
    const flag =
      resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    return this.admin.listAcceptanceReports(flag);
  }

  @Post('acceptance-reports/:id/resolve')
  @UseGuards(AdminJwtGuard)
  resolveAcceptance(@Param('id') id: string) {
    return this.admin.resolveAcceptanceReport(id);
  }

  @Post('verifications/:id/reject')
  @UseGuards(AdminJwtGuard)
  rejectVerification(
    @Param('id') id: string,
    @CurrentAdmin() a: { adminId: string },
    @Body() dto: RejectVerificationDto
  ) {
    return this.admin.rejectVerification(id, a.adminId, dto.reason);
  }

  @Get('pricing')
  @UseGuards(AdminJwtGuard)
  pricing() {
    return this.admin.listPricing();
  }

  @Post('pricing/packages')
  @UseGuards(AdminJwtGuard)
  createPackage(@Body() dto: UpsertDurationPackageDto) {
    return this.admin.createDurationPackage(dto);
  }

  @Patch('pricing/packages/:id')
  @UseGuards(AdminJwtGuard)
  updatePackage(@Param('id') id: string, @Body() dto: UpsertDurationPackageDto) {
    return this.admin.updateDurationPackage(id, dto);
  }

  @Delete('pricing/packages/:id')
  @UseGuards(AdminJwtGuard)
  deletePackage(@Param('id') id: string) {
    return this.admin.deleteDurationPackage(id);
  }

  @Put('pricing/night')
  @UseGuards(AdminJwtGuard)
  upsertNight(@Body() dto: UpsertNightPricingDto) {
    return this.admin.upsertNightPricing(dto);
  }

  @Delete('pricing/night/:id')
  @UseGuards(AdminJwtGuard)
  deleteNight(@Param('id') id: string) {
    return this.admin.deleteNightPricing(id);
  }
}
