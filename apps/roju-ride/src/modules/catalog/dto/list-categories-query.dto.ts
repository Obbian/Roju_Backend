import { IsOptional, IsString, MinLength } from 'class-validator';

export class ListCategoriesQueryDto {
  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
