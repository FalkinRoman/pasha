import { IsString, MinLength } from 'class-validator';

export class ConfirmQrDto {
  @IsString()
  @MinLength(8)
  challengeId!: string;
}
