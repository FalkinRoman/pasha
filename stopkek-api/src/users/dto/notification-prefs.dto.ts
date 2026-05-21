import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  session?: boolean;

  @IsOptional()
  @IsBoolean()
  remind?: boolean;

  @IsOptional()
  @IsBoolean()
  promo?: boolean;
}
