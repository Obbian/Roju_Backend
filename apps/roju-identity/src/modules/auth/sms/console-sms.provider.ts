import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider } from './sms-provider.interface';

// Dev/CI fallback when no MSG91 auth key is configured — logs the code instead of sending a
// real SMS, so the OTP flow stays testable end-to-end without live credentials.
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('OTP');

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    this.logger.log(`${phoneNumber} -> ${otp}`);
  }
}
