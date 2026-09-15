import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

// NO_DRIVER_FOUND and SYSTEM are set by the platform itself (Matching, ops tooling), never
// submitted by a client.
export class CancelRideDto {
  @ApiProperty({ enum: ['USER_CANCELLED', 'DRIVER_CANCELLED'], example: 'USER_CANCELLED' })
  @IsIn(['USER_CANCELLED', 'DRIVER_CANCELLED'])
  reason!: 'USER_CANCELLED' | 'DRIVER_CANCELLED';
}
