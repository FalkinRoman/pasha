import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertDurationPackageDto {
  @IsOptional()
  @IsString()
  zoneId?: string | null;

  @IsInt()
  @Min(1)
  @Max(12)
  minHours!: number;

  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent!: number;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  badge?: string | null;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
