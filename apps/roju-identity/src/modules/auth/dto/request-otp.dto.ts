import { Matches } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;
}
