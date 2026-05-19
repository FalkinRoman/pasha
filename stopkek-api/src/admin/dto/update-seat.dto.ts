import { IsEnum } from 'class-validator';
import { SeatStatus } from '@prisma/client';

export class UpdateSeatDto {
  @IsEnum(SeatStatus)
  status!: SeatStatus;
}
