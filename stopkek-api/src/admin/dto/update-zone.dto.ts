import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  specs?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerHour?: number;
}
