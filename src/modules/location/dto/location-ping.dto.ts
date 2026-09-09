import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class LocationPingDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @IsOptional()
  @IsNumber()
  speedKmph?: number;

  @IsOptional()
  @IsInt()
  headingDegrees?: number;

  @IsOptional()
  @IsInt()
  accuracyMetres?: number;

  // Set only while an active ride is underway — pings sent while idle/online-but-unmatched
  // update the geo-cache but have nothing to archive into ride_route_points.
  @IsOptional()
  @IsUUID()
  rideId?: string;
}
