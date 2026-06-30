import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  seatId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  durationHours!: number;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsString()
  timeWindowId?: string;
}
