import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('active')
  active(@CurrentUser() u: { userId: string }) {
    return this.bookings.getActive(u.userId);
  }

  @Get('history')
  history(@CurrentUser() u: { userId: string }) {
    return this.bookings.getHistory(u.userId);
  }

  @Post()
  create(@CurrentUser() u: { userId: string }, @Body() dto: CreateBookingDto) {
    return this.bookings.create(
      u.userId,
      dto.seatId,
      dto.durationHours,
      dto.startAt
    );
  }

  @Post(':id/pay')
  pay(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.bookings.payFromWallet(u.userId, id);
  }

  @Delete(':id')
  cancel(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.bookings.cancelPending(u.userId, id);
  }
}
