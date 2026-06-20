import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() u: { userId: string }, @Body() dto: CreateFeedbackDto) {
    await this.prisma.feedback.create({
      data: {
        userId: u.userId,
        rating: dto.rating,
        message: dto.message.trim(),
      },
    });
    return { ok: true };
  }
}
