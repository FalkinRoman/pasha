import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  seatId!: string;

  // Fractional hours are allowed at the DTO level so the test path (16 min) can
  // pass; sub-1h values are gated to test mode in BookingsService.
  @IsNumber()
  @Min(0.25)
  @Max(12)
  durationHours!: number;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsString()
  timeWindowId?: string;

  /** Short (sub-hour) test booking — only honoured when the test gate is enabled. */
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}
