import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class KioskTelemetryDto {
  @IsInt()
  @Min(1)
  seatNumber!: number;

  /** heartbeat | tamper | shell_killed | offline | ... */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  detail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hostname?: string;
}
