import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitAcceptanceDto {
  @IsObject()
  items!: Record<string, boolean>;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsBoolean()
  hasIssue!: boolean;
}
