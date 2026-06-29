import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ExtendBookingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  hours?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  minutes?: number;
}
