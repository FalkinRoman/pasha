import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SeatStatus } from '@prisma/client';

export class CreateSeatDto {
  @IsString()
  zoneId!: string;

  @IsInt()
  @Min(1)
  number!: number;

  @IsOptional()
  @IsEnum(SeatStatus)
  status?: SeatStatus;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;
}
