import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertNightPricingDto {
  @IsOptional()
  @IsString()
  zoneId?: string | null;

  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  endHour!: number;

  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
