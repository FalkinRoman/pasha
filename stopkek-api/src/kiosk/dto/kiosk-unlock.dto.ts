import { IsInt, IsString, Length, Min } from 'class-validator';

export class KioskUnlockDto {
  @IsInt()
  @Min(1)
  seatNumber!: number;

  @IsString()
  @Length(6, 6)
  code!: string;
}
