import { Logger } from '@nestjs/common';
import type { SmsProvider } from './sms-provider.interface';

// Tries each real (credentialed) provider in order — MSG91 first, then Twilio if configured
// — and only falls back to logging the OTP to console if every configured provider's own
// retry budget (see with-retry.ts) is exhausted. This is the layer that actually answers
// "what if MSG91 isn't working" — a second, independently-credentialed provider gets a real
// shot at delivering the SMS before giving up to the console fallback, whereas MSG91's own
// retries only cover a single provider having a transient blip.
export class ChainedSmsProvider implements SmsProvider {
  private readonly logger = new Logger('OTP');

  constructor(private readonly providers: SmsProvider[]) {}

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    for (const provider of this.providers) {
      try {
        await provider.sendOtp(phoneNumber, otp);
        return;
      } catch (err) {
        this.logger.warn(
          `${provider.constructor.name} exhausted its retries for ${phoneNumber}: ${(err as Error).message} — trying next provider`,
        );
      }
    }

    this.logger.error(
      `All configured SMS providers failed for ${phoneNumber} — falling back to console delivery`,
    );
    this.logger.log(`[FALLBACK] ${phoneNumber} -> ${otp}`);
  }
}
