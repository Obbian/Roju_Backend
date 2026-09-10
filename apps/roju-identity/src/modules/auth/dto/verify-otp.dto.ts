import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { RegisteredVia } from './registered-via.enum';

export class VerifyOtpDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;

  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp!: string;

  @IsEnum(RegisteredVia)
  registeredVia!: RegisteredVia;

  // Which Roju app is calling — 'RIDE' | 'FIXIT' | ... Defaults to RIDE since it's the only
  // one that exists today; every other app sends its own code once it's built.
  @IsOptional()
  @IsString()
  @MinLength(1)
  serviceCode?: string;

  // From the onboarding language-picker screen, e.g. 'en-IN' / 'hi-IN'. Optional — existing
  // sessions on an already-onboarded device won't send it again.
  @IsOptional()
  @Matches(/^[a-z]{2}-[A-Z]{2}$/, { message: 'preferredLanguage must look like en-IN' })
  preferredLanguage?: string;
}
