import { IsInt, Max, Min } from 'class-validator';

export class ExtendBookingDto {
  @IsInt()
  @Min(1)
  @Max(8)
  hours!: number;
}
