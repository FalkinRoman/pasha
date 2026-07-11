import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QuoteBookingDto {
  @IsString()
  seatId!: string;

  // Fractional hours allowed for the 16-min test path; gated in BookingsService.
  @IsNumber()
  @Min(0.25)
  @Max(12)
  durationHours!: number;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  /** id интервала NightPricing — скидка только при явном выборе пакета */
  @IsOptional()
  @IsString()
  timeWindowId?: string;

  /** Short (sub-hour) test quote — only honoured when the test gate is enabled. */
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}
