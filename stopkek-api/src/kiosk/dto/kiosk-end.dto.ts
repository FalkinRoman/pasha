import { IsInt, Min } from 'class-validator';

export class KioskEndDto {
  @IsInt()
  @Min(1)
  seatNumber!: number;
}
