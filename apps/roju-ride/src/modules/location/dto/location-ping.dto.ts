import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class LocationPingDto {
  @ApiProperty({ example: 17.4401, description: 'Gachibowli (a Hyderabad rush locality)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 78.3489 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsNumber()
  speedKmph?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  headingDegrees?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  accuracyMetres?: number;

  // Set only while an active ride is underway — pings sent while idle/online-but-unmatched
  // update the geo-cache but have nothing to archive into ride_route_points.
  @ApiPropertyOptional({
    example: '9c76f182-3bce-4c3a-8e50-01dc81ce79c9',
    description: 'Omit when idle/online-but-unmatched',
  })
  @IsOptional()
  @IsUUID()
  rideId?: string;
}
