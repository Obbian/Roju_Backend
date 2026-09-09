import { IsEnum, Matches } from 'class-validator';
import { RegisteredVia } from './registered-via.enum';

export class VerifyOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;

  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp!: string;

  @IsEnum(RegisteredVia)
  registeredVia!: RegisteredVia;
}
