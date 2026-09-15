import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+919000011111' })
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;
}
