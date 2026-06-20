import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdentityService } from './identity.service';

@Controller('identity')
@UseGuards(JwtAuthGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('status')
  status(@CurrentUser() user: { userId: string }) {
    return this.identity.getStatus(user.userId);
  }

  @Post('submit')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  submit(
    @CurrentUser() user: { userId: string },
    @UploadedFile() file: Express.Multer.File,
    @Body('pdConsent') pdConsent: string
  ) {
    const agreed =
      pdConsent === 'true' || pdConsent === '1' || pdConsent === 'on';
    return this.identity.submit(user.userId, file, agreed);
  }
}
