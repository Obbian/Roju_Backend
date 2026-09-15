import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LocaleQueryDto {
  @ApiPropertyOptional({ example: 'en-IN' })
  @IsOptional()
  @IsString()
  locale?: string;
}
