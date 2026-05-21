import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { SubmitAcceptanceDto } from './dto/acceptance.dto';

function parseAcceptanceItems(raw: unknown): Record<string, boolean> {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, boolean>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    } catch {
      /* multipart / invalid */
    }
  }
  return {};
}

function parseAcceptanceHasIssue(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') return raw === 'true' || raw === '1';
  return false;
}
import { CreateBookingDto } from './dto/create-booking.dto';
import { ExtendBookingDto } from './dto/extend.dto';

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

  @Post(':id/door')
  openDoor(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @Body('type') type: 'main' | 'cell'
  ) {
    return this.bookings.openDoor(u.userId, id, type);
  }

  @Post(':id/extend')
  extend(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @Body() dto: ExtendBookingDto
  ) {
    return this.bookings.extendSession(u.userId, id, dto.hours);
  }

  @Post(':id/acceptance')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  acceptance(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() photo?: Express.Multer.File
  ) {
    const dto: SubmitAcceptanceDto = {
      items: parseAcceptanceItems(body.items),
      comment:
        typeof body.comment === 'string' ? body.comment : undefined,
      hasIssue: parseAcceptanceHasIssue(body.hasIssue),
    };
    return this.bookings.submitAcceptance(u.userId, id, dto, photo);
  }

  @Post(':id/checkout/start')
  startCheckout(@CurrentUser() u: { userId: string }, @Param('id') id: string) {
    return this.bookings.startCheckout(u.userId, id);
  }

  @Post(':id/checkout/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  checkoutPhoto(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File
  ) {
    return this.bookings.saveCheckoutPhoto(u.userId, id, photo);
  }

  @Post(':id/checkout/complete')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  completeCheckout(
    @CurrentUser() u: { userId: string },
    @Param('id') id: string,
    @UploadedFile() photo?: Express.Multer.File
  ) {
    return this.bookings.completeCheckout(u.userId, id, photo);
  }
}
