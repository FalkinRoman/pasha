import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExtendBookingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  hours?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  minutes?: number;

  @IsOptional()
  @IsString()
  timeWindowId?: string;
}
