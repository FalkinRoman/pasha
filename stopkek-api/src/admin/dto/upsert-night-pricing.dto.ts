import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertNightPricingDto {
  @IsOptional()
  @IsString()
  zoneId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  endHour!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
