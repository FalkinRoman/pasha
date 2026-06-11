import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ExtendBookingDto } from './dto/extend.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';

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

  @Get(':id')
  byId(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.bookings.getById(u.userId, id);
  }

  @Post('quote')
  quote(@Body() dto: QuoteBookingDto) {
    return this.bookings.quote(dto.seatId, dto.durationHours, dto.startAt);
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

  @Post(':id/door')
  openDoor(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.bookings.openMainDoor(u.userId, id);
  }

  @Post(':id/extend')
  extend(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @Body() dto: ExtendBookingDto
  ) {
    return this.bookings.extendSession(u.userId, id, dto.hours);
  }

  @Post(':id/end')
  end(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.bookings.endSession(u.userId, id);
  }

}
