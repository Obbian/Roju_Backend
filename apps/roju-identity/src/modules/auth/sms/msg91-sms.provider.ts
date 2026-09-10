import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

interface Msg91OtpResponse {
  type: 'success' | 'error';
  message: string;
}

// MSG91's OTP-send endpoint, given OUR own pre-generated code (not theirs) — the
// cooldown/hashing/attempt-lockout policy in OtpService stays the single source of truth;
// MSG91 is purely the delivery channel here, not a second place OTP state could live.
//
// Verified against the real API: it returns HTTP 200 { type: "success" } even for a
// completely invalid authkey/template_id — the request is queued, not validated
// synchronously. A clean response here is NOT proof the SMS was actually delivered; only
// malformed requests (missing params, wrong shape) surface as an error at this call. Real
// delivery failures (bad auth key, exhausted balance, DND-blocked number) only show up in
// MSG91's own dashboard/delivery-report webhook — verify real credentials against a phone
// you control, don't trust a 200 here as confirmation.
@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  private readonly logger = new Logger('OTP');

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    const authKey = this.config.getOrThrow<string>('sms.msg91AuthKey');
    const templateId = this.config.getOrThrow<string>('sms.msg91OtpTemplateId');
    // MSG91 expects the mobile number without a leading '+' (e.g. 919876543210).
    const mobile = phoneNumber.replace(/^\+/, '');

    const url = new URL(MSG91_OTP_URL);
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('otp', otp);

    let body: Msg91OtpResponse | null = null;
    try {
      const response = await fetch(url, { method: 'POST' });
      body = (await response.json()) as Msg91OtpResponse;
      if (!response.ok || body?.type !== 'success') {
        throw new Error(body?.message ?? `HTTP ${response.status}`);
      }
    } catch (err) {
      this.logger.error(`MSG91 send failed for ${mobile}: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to send verification code');
    }
  }
}
