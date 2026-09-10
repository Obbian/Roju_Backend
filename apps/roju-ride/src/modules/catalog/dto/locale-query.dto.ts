import { IsOptional, IsString } from 'class-validator';

export class LocaleQueryDto {
  @IsOptional()
  @IsString()
  locale?: string;
}
