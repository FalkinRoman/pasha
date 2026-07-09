import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, resolveClientIp } from './auth.service';
import { CallcheckPollDto } from './dto/callcheck-poll.dto';
import { CallRequestDto } from './dto/call-request.dto';
import { CallVerifyDto } from './dto/call-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('call/request')
  requestCall(@Body() dto: CallRequestDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const raw =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket.remoteAddress;
    return this.auth.requestCall(dto, resolveClientIp(raw));
  }

  @Post('call/verify')
  verifyCall(@Body() dto: CallVerifyDto) {
    return this.auth.verifyCall(dto);
  }

  @Post('sms/request')
  requestSms(@Body() dto: CallRequestDto) {
    return this.auth.requestSms(dto);
  }

  @Post('sms/verify')
  verifySms(@Body() dto: CallVerifyDto) {
    return this.auth.verifySms(dto);
  }

  @Post('callcheck/request')
  requestCallcheck(@Body() dto: CallRequestDto) {
    return this.auth.requestCallcheck(dto);
  }

  @Post('callcheck/poll')
  pollCallcheck(@Body() dto: CallcheckPollDto) {
    return this.auth.pollCallcheck(dto);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body?.refreshToken ?? '');
  }
}
