import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateRideDto {
  @ApiProperty({ example: 'AUTO', description: 'ride_categories.code — AUTO, BIKE or CABX' })
  @IsString()
  @MinLength(1)
  rideType!: string;

  @ApiProperty({ example: 'Hyderabad' })
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiProperty({ example: 17.4401, description: 'Gachibowli (a Hyderabad rush locality)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat!: number;

  @ApiProperty({ example: 78.3489 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLon!: number;

  @ApiPropertyOptional({ example: 'Gachibowli' })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiProperty({ example: 17.4239, description: 'Jubilee Hills' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat!: number;

  @ApiProperty({ example: 78.4738 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLon!: number;

  @ApiPropertyOptional({ example: 'Jubilee Hills' })
  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  // "Book for someone else" — free text, display-only (rides.passengerName/Phone)
  @ApiPropertyOptional({ example: 'Ramesh Kumar' })
  @IsOptional()
  @IsString()
  passengerName?: string;

  @ApiPropertyOptional({ example: '+919000012345' })
  @IsOptional()
  @IsString()
  passengerPhone?: string;

  @ApiPropertyOptional({ example: 'WELCOME50' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
