import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 10_000;

interface Msg91OtpResponse {
  type: 'success' | 'error';
  message: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
//
// Retries transient failures (network errors, timeouts, non-2xx) a few times, and if every
// attempt fails, falls back to logging the OTP to console instead of throwing — the account
// signup/login flow (OtpService's Redis-backed state) shouldn't go down just because MSG91 is
// having an outage or a key got misconfigured; a support/dev channel can still read the code
// off the server log and relay it while the underlying MSG91 issue gets fixed.
@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  private readonly logger = new Logger('OTP');

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    const authKey = this.config.getOrThrow<string>('sms.msg91AuthKey');
    const templateId = this.config.getOrThrow<string>('sms.msg91OtpTemplateId');
    // MSG91 expects the mobile number without a leading '+' (e.g. 919876543210).
    const mobile = phoneNumber.replace(/^\+/, '');

    let lastError = 'unknown error';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.attemptSend(mobile, otp, authKey, templateId);
        this.logger.log(`MSG91 accepted OTP for ${mobile} (attempt ${attempt}/${MAX_ATTEMPTS})`);
        return;
      } catch (err) {
        lastError = (err as Error).message;
        this.logger.warn(
          `MSG91 send attempt ${attempt}/${MAX_ATTEMPTS} failed for ${mobile}: ${lastError}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // Every retry exhausted — log loudly (this is the signal an on-call/dev should notice:
    // bad credentials, exhausted MSG91 balance, or an actual MSG91 outage) and fall back to
    // console delivery rather than failing the whole otp/request call.
    this.logger.error(
      `MSG91 unreachable after ${MAX_ATTEMPTS} attempts for ${mobile} (${lastError}) — falling back to console delivery`,
    );
    this.logger.log(`[FALLBACK] ${phoneNumber} -> ${otp}`);
  }

  private async attemptSend(
    mobile: string,
    otp: string,
    authKey: string,
    templateId: string,
  ): Promise<void> {
    const url = new URL(MSG91_OTP_URL);
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', mobile);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('otp', otp);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', signal: controller.signal });
    } catch (err) {
      throw new Error(
        (err as Error).name === 'AbortError'
          ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `network error: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    const body = (await response.json().catch(() => null)) as Msg91OtpResponse | null;
    if (!response.ok || body?.type !== 'success') {
      throw new Error(body?.message ?? `HTTP ${response.status}`);
    }
  }
}
