import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class EstimateFareQueryDto {
  @ApiProperty({ example: 'Hyderabad' })
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiProperty({ example: 'AUTO' })
  @IsString()
  @MinLength(1)
  rideType!: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm!: number;

  @ApiProperty({ example: 15 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMin!: number;

  // Optional — when given, folds a live weather-based surge multiplier into the estimate
  // (WeatherService). Omit for a plain, weather-agnostic quote.
  @ApiPropertyOptional({ example: 17.4401, description: 'Enables weather-based surge in the estimate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat?: number;

  @ApiPropertyOptional({ example: 78.3489 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLon?: number;
}
