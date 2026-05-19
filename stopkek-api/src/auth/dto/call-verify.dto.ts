import { IsString, IsUUID, Length, Matches, MinLength } from 'class-validator';

export class CallVerifyDto {
  @IsUUID('4')
  sessionId!: string;

  @IsString()
  @MinLength(10)
  @Matches(/^\+?\d{10,15}$/)
  phone!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  code!: string;
}
