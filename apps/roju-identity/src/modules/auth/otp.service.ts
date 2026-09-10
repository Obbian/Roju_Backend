import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms-provider.interface';

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(phoneNumber: string, otp: string): string {
  return createHash('sha256').update(`${phoneNumber}:${otp}`).digest('hex');
}

// Redis-backed OTP issuance/verification (cooldown, hashing, attempt-lockout). Delivery is
// delegated to SMS_PROVIDER — MSG91 in production, console logging in dev/CI where no real
// credentials exist (see sms/sms.module.ts).
@Injectable()
export class OtpService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(phoneNumber: string): Promise<void> {
    const cooldownKey = `otp:cooldown:${phoneNumber}`;
    if (await this.redis.exists(cooldownKey)) {
      throw new BadRequestException('Please wait before requesting another code');
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ttlSeconds = this.config.get<number>('otp.ttlSeconds') ?? 300;

    await this.redis
      .multi()
      .set(`otp:${phoneNumber}`, hashOtp(phoneNumber, otp), 'EX', ttlSeconds)
      .set(`otp:attempts:${phoneNumber}`, 0, 'EX', ttlSeconds)
      .set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS)
      .exec();

    await this.smsProvider.sendOtp(phoneNumber, otp);
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<void> {
    const key = `otp:${phoneNumber}`;
    const attemptsKey = `otp:attempts:${phoneNumber}`;

    const storedHash = await this.redis.get(key);
    if (!storedHash) {
      throw new UnauthorizedException('Code expired or not requested');
    }

    const attempts = await this.redis.incr(attemptsKey);
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(key, attemptsKey);
      throw new UnauthorizedException('Too many incorrect attempts, request a new code');
    }

    if (hashOtp(phoneNumber, otp) !== storedHash) {
      throw new UnauthorizedException('Incorrect code');
    }

    await this.redis.del(key, attemptsKey);
  }
}
