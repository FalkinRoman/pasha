import { Controller, Get } from '@nestjs/common';
import { ClubService } from './club.service';

@Controller('club')
export class ClubController {
  constructor(private readonly club: ClubService) {}

  @Get()
  getClub() {
    return this.club.getClub();
  }

  @Get('floor-map')
  getFloorMap() {
    return this.club.getFloorMap();
  }
}
