import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertDurationPackageDto {
  @IsOptional()
  @IsString()
  zoneId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  minHours!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent!: number;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  badge?: string | null;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
