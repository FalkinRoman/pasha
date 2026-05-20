import { IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug: только a-z, 0-9, дефис' })
  slug!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  specs?: string;

  @IsInt()
  @Min(1)
  pricePerHour!: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
