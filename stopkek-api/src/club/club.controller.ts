import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ClubService } from './club.service';

@Controller('club')
export class ClubController {
  constructor(private readonly club: ClubService) {}

  @Get()
  getClub() {
    return this.club.getClub();
  }

  @Get('image')
  clubImage(@Res() res: Response) {
    return this.club.streamClubImage(res);
  }

  @Get('floor-map')
  getFloorMap() {
    return this.club.getFloorMap();
  }

  @Get('pricing')
  getPricing() {
    return this.club.getPricing();
  }
}
