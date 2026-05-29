import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfirmQrDto } from './dto/confirm-qr.dto';
import { KioskUnlockDto } from './dto/kiosk-unlock.dto';
import { KioskGuard } from './kiosk.guard';
import { KioskService } from './kiosk.service';

@Controller('kiosk')
export class KioskController {
  constructor(private readonly kiosk: KioskService) {}

  @Post('bookings/:id/pc-code')
  @UseGuards(JwtAuthGuard)
  pcCode(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.kiosk.issuePcCode(u.userId, id);
  }

  @Get('state')
  @UseGuards(KioskGuard)
  state(@Query('seatNumber') seatNumber: string) {
    const n = Number(seatNumber);
    if (!Number.isFinite(n) || n < 1) {
      return { state: 'locked', seatNumber: 0 };
    }
    return this.kiosk.getSeatState(n);
  }

  @Post('unlock')
  @UseGuards(KioskGuard)
  unlock(@Body() dto: KioskUnlockDto) {
    return this.kiosk.unlock(dto.seatNumber, dto.code);
  }

  @Post('bookings/:id/confirm-qr')
  @UseGuards(JwtAuthGuard)
  confirmQr(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @Body() body: ConfirmQrDto
  ) {
    return this.kiosk.confirmQr(u.userId, id, body.challengeId);
  }
}
