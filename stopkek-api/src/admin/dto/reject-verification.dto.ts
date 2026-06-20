import { IsString, MinLength } from 'class-validator';

export class RejectVerificationDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
