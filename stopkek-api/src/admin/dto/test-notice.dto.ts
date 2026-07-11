import { IsString, MaxLength, MinLength } from 'class-validator';

/** Admin → kiosk PC test toast. */
export class TestNoticeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text!: string;
}
