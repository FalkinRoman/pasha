import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfirmQrDto } from './dto/confirm-qr.dto';
import { KioskEndDto } from './dto/kiosk-end.dto';
import { KioskTelemetryDto } from './dto/kiosk-telemetry.dto';
import { KioskUnlockDto } from './dto/kiosk-unlock.dto';
import { KioskGuard } from './kiosk.guard';
import { KioskService } from './kiosk.service';
import { KioskTelemetryService } from './kiosk-telemetry.service';

@Controller('kiosk')
export class KioskController {
  constructor(
    private readonly kiosk: KioskService,
    private readonly telemetry: KioskTelemetryService
  ) {}

  @Post('bookings/:id/pc-code')
  @UseGuards(JwtAuthGuard)
  pcCode(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.kiosk.issuePcCode(u.userId, id);
  }

  @Get('state')
  @UseGuards(KioskGuard)
  state(@Query('seatNumber') seatNumber: string, @Req() req: Request) {
    const n = Number(seatNumber);
    if (!Number.isFinite(n) || n < 1) {
      return { state: 'locked', seatNumber: 0 };
    }
    this.telemetry.heartbeat(n, { ip: req.ip });
    return this.kiosk.getSeatState(n);
  }

  @Post('unlock')
  @UseGuards(KioskGuard)
  unlock(@Body() dto: KioskUnlockDto) {
    return this.kiosk.unlock(dto.seatNumber, dto.code);
  }

  @Post('end-session')
  @UseGuards(KioskGuard)
  endSession(@Body() dto: KioskEndDto) {
    return this.kiosk.endSeatSession(dto.seatNumber);
  }

  @Post('telemetry')
  @UseGuards(KioskGuard)
  telemetryReport(@Body() dto: KioskTelemetryDto, @Req() req: Request) {
    if (dto.type && dto.type !== 'heartbeat') {
      this.telemetry.event(dto.seatNumber, dto.type, dto.detail);
    } else {
      this.telemetry.heartbeat(dto.seatNumber, {
        hostname: dto.hostname,
        ip: req.ip,
      });
    }
    return { ok: true };
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
