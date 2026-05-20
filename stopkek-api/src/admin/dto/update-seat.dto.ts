import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { SeatStatus } from '@prisma/client';

export class UpdateSeatDto {
  @IsOptional()
  @IsEnum(SeatStatus)
  status?: SeatStatus;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;
}
