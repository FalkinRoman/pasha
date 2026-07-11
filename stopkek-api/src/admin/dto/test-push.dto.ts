import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Admin → user phone test push. Looked up by phone, sent via Expo. */
export class TestPushDto {
  @IsString()
  @MinLength(3)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  body?: string;
}
