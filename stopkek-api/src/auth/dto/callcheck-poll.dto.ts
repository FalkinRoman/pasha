import { IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CallcheckPollDto {
  @IsUUID('4')
  sessionId!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^\+?\d{10,15}$/)
  phone!: string;
}
