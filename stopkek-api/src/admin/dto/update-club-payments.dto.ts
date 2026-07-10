import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateClubPaymentsDto {
  @IsOptional()
  @IsBoolean()
  yookassaEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  mockTopupEnabled?: boolean;
}
