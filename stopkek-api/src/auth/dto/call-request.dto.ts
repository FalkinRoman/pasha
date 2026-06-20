import { IsString, Matches, MinLength } from 'class-validator';

export class CallRequestDto {
  @IsString()
  @MinLength(10)
  @Matches(/^\+?\d{10,15}$/)
  phone!: string;
}
