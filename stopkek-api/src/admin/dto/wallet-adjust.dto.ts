import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class WalletAdjustDto {
  /** Сумма в копейках (+ пополнение, − списание) */
  @IsInt()
  @Min(-10_000_000)
  @Max(10_000_000)
  amountKopecks!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
