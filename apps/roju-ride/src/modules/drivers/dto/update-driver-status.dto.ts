import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateDriverStatusDto {
  @ApiProperty({ enum: ['ONLINE', 'OFFLINE'], example: 'ONLINE' })
  @IsIn(['ONLINE', 'OFFLINE'])
  status!: 'ONLINE' | 'OFFLINE';
}
