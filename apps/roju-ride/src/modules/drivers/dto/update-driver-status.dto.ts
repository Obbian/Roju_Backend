import { IsIn } from 'class-validator';

export class UpdateDriverStatusDto {
  @IsIn(['ONLINE', 'OFFLINE'])
  status!: 'ONLINE' | 'OFFLINE';
}
