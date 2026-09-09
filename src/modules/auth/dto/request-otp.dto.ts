import { IsEnum, Matches } from 'class-validator';
import { RegisteredVia } from './registered-via.enum';

export class RequestOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;

  @IsEnum(RegisteredVia)
  registeredVia!: RegisteredVia;
}
