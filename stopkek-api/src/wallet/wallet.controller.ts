import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TopupDto } from './dto/topup.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard)
  config() {
    return this.wallet.getConfig();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  transactions(@CurrentUser() u: { userId: string }) {
    return this.wallet.getTransactions(u.userId);
  }

  @Post('topup/create')
  @UseGuards(JwtAuthGuard)
  createTopup(@CurrentUser() u: { userId: string }, @Body() dto: TopupDto) {
    return this.wallet.createTopup(u.userId, dto.amount);
  }

  @Post('topup/mock')
  @UseGuards(JwtAuthGuard)
  mockTopup(@CurrentUser() u: { userId: string }, @Body() dto: TopupDto) {
    return this.wallet.mockTopup(u.userId, dto.amount);
  }

  @Get('topup/:paymentId/status')
  @UseGuards(JwtAuthGuard)
  topupStatus(
    @CurrentUser() u: { userId: string },
    @Param('paymentId') paymentId: string
  ) {
    return this.wallet.getTopupStatus(u.userId, paymentId);
  }
}
