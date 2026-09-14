import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';
import { withRetry } from './with-retry';

interface TwilioErrorResponse {
  message?: string;
  code?: number;
}

// Secondary/backup delivery channel — only used when Twilio credentials are configured (see
// sms.module.ts's provider chain). Plain SMS send via Twilio's Messages API, not their
// Verify product — Verify manages its own OTP lifecycle, which would compete with
// OtpService's Redis-backed state as a second source of truth. Here Twilio is purely a pipe
// for a code OtpService already generated, same role MSG91 plays.
@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger('OTP');

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    const accountSid = this.config.getOrThrow<string>('sms.twilioAccountSid');
    const authToken = this.config.getOrThrow<string>('sms.twilioAuthToken');
    const fromNumber = this.config.getOrThrow<string>('sms.twilioFromNumber');

    await withRetry(this.logger, 'Twilio', phoneNumber, (signal) =>
      this.attemptSend(phoneNumber, otp, accountSid, authToken, fromNumber, signal),
    );
  }

  private async attemptSend(
    phoneNumber: string,
    otp: string,
    accountSid: string,
    authToken: string,
    fromNumber: string,
    signal: AbortSignal,
  ): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: phoneNumber,
      From: fromNumber,
      Body: `Your Roju verification code is ${otp}`,
    });

    const response = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }).catch((err) => {
      throw new Error(`network error: ${(err as Error).message}`);
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as TwilioErrorResponse | null;
      throw new Error(errorBody?.message ?? `HTTP ${response.status}`);
    }
  }
}
