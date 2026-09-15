import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RideStopDto {
  @ApiProperty({ example: 17.412281 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 78.459818 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @ApiPropertyOptional({ example: 'HITEC City' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateRideStopsDto {
  @ApiProperty({
    type: [RideStopDto],
    description: 'Full desired stop list (replace-all) — max 5, empty array clears all stops',
    example: [{ lat: 17.412281, lon: 78.459818, address: 'HITEC City' }],
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => RideStopDto)
  stops!: RideStopDto[];
}
