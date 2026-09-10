// Kept as an interface (not just "call MSG91 directly from OtpService") for one concrete
// reason: local/CI environments never have real MSG91 credentials, and OtpService's
// cooldown/hashing/lockout logic still needs to be testable without them. The provider
// swap (see sms.module.ts) is what makes that possible — this is not speculative
// abstraction for a hypothetical second SMS vendor.
export interface SmsProvider {
  sendOtp(phoneNumber: string, otp: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
