import { IsNumber, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class EstimateFareQueryDto {
  @IsString()
  @MinLength(1)
  city!: string;

  @IsString()
  @MinLength(1)
  rideType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMin!: number;
}
