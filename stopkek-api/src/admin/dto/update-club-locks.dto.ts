import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LockProvider } from '@prisma/client';

export class UpdateClubLocksDto {
  @IsOptional()
  @IsEnum(LockProvider)
  lockProvider?: LockProvider;

  @IsOptional()
  @IsString()
  mainDoorLockId?: string;

  @IsOptional()
  @IsString()
  lockHttpBaseUrl?: string;

  @IsOptional()
  @IsString()
  lockHttpToken?: string;

  @IsOptional()
  @IsString()
  lockMqttTopic?: string;
}
