import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

export class QuoteBookingDto {
  @IsString()
  seatId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  durationHours!: number;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  /** id интервала NightPricing — скидка только при явном выборе пакета */
  @IsOptional()
  @IsString()
  timeWindowId?: string;
}
