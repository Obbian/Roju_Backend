import { IsIn } from 'class-validator';

// NO_DRIVER_FOUND and SYSTEM are set by the platform itself (Matching, ops tooling), never
// submitted by a client.
export class CancelRideDto {
  @IsIn(['USER_CANCELLED', 'DRIVER_CANCELLED'])
  reason!: 'USER_CANCELLED' | 'DRIVER_CANCELLED';
}
