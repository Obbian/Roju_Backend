import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateRideDto {
  @IsString()
  @MinLength(1)
  rideType!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLon!: number;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLon!: number;

  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  // "Book for someone else" — free text, display-only (rides.passengerName/Phone)
  @IsOptional()
  @IsString()
  passengerName?: string;

  @IsOptional()
  @IsString()
  passengerPhone?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;
}
