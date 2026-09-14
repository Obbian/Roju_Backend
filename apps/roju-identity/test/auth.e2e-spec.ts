import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { REDIS } from '../src/redis/redis.module';
import { SMS_PROVIDER, type SmsProvider } from '../src/modules/auth/sms/sms-provider.interface';

// Swaps out real SMS delivery so the test can read back whatever OTP OtpService generated,
// without touching OtpService's own cooldown/hashing/lockout logic (see sms-provider.interface.ts).
class CapturingSmsProvider implements SmsProvider {
  private readonly otps = new Map<string, string>();

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    this.otps.set(phoneNumber, otp);
  }

  otpFor(phoneNumber: string): string {
    const otp = this.otps.get(phoneNumber);
    if (!otp) throw new Error(`No OTP captured for ${phoneNumber}`);
    return otp;
  }
}

let phoneCounter = 0;
function uniquePhone(): string {
  phoneCounter += 1;
  const suffix =
    (Date.now() % 100000).toString().padStart(5, '0') + phoneCounter.toString().padStart(3, '0');
  return `+9199${suffix}`;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let redis: Redis;
  const sms = new CapturingSmsProvider();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Mirrors main.ts's bootstrap exactly — the TestingModule doesn't run main.ts, so without
    // this, validation is silently skipped and every DTO constraint test below is meaningless.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    redis = moduleFixture.get(REDIS);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function requestAndVerify(
    phoneNumber: string,
    registeredVia: string,
    extra: Record<string, unknown> = {},
  ) {
    await request(server()).post('/api/v1/auth/otp/request').send({ phoneNumber }).expect(204);
    return request(server())
      .post('/api/v1/auth/otp/verify')
      .send({ phoneNumber, otp: sms.otpFor(phoneNumber), registeredVia, ...extra });
  }

  function expectStatus(res: request.Response, status: number) {
    expect(res.status).toBe(status);
    return res;
  }

  describe('otp/request', () => {
    it('accepts a fresh phone number', async () => {
      await request(server())
        .post('/api/v1/auth/otp/request')
        .send({ phoneNumber: uniquePhone() })
        .expect(204);
    });

    it('rejects an immediate repeat request (cooldown)', async () => {
      const phoneNumber = uniquePhone();
      await request(server()).post('/api/v1/auth/otp/request').send({ phoneNumber }).expect(204);
      await request(server()).post('/api/v1/auth/otp/request').send({ phoneNumber }).expect(400);
    });

    it('rejects a malformed phone number', async () => {
      await request(server())
        .post('/api/v1/auth/otp/request')
        .send({ phoneNumber: '12345' })
        .expect(400);
    });
  });

  describe('otp/verify', () => {
    it('rejects an incorrect code', async () => {
      const phoneNumber = uniquePhone();
      await request(server()).post('/api/v1/auth/otp/request').send({ phoneNumber }).expect(204);
      await request(server())
        .post('/api/v1/auth/otp/verify')
        .send({ phoneNumber, otp: '000000', registeredVia: 'CONSUMER_APP' })
        .expect(401);
    });

    it('locks out after too many incorrect attempts', async () => {
      const phoneNumber = uniquePhone();
      await request(server()).post('/api/v1/auth/otp/request').send({ phoneNumber }).expect(204);

      for (let i = 0; i < 5; i++) {
        await request(server())
          .post('/api/v1/auth/otp/verify')
          .send({ phoneNumber, otp: '000000', registeredVia: 'CONSUMER_APP' })
          .expect(401);
      }

      const res = await request(server())
        .post('/api/v1/auth/otp/verify')
        .send({ phoneNumber, otp: '000000', registeredVia: 'CONSUMER_APP' })
        .expect(401);
      expect(res.body.message).toMatch(/too many/i);
    });

    it('creates a rider account on first verify and issues tokens', async () => {
      const phoneNumber = uniquePhone();
      const res = expectStatus(
        await requestAndVerify(phoneNumber, 'CONSUMER_APP', { preferredLanguage: 'hi-IN' }),
        201,
      );

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.phoneNumber).toBe(phoneNumber);
      expect(res.body.user.role).toBe('RIDER');
      expect(res.body.user.preferredLanguage).toBe('hi-IN');
      expect(res.body.membership).toMatchObject({
        serviceCode: 'RIDE',
        membershipRole: 'CUSTOMER',
      });
    });

    it('creates a driver account for EXECUTIVE_APP', async () => {
      const phoneNumber = uniquePhone();
      const res = expectStatus(await requestAndVerify(phoneNumber, 'EXECUTIVE_APP'), 201);

      expect(res.body.user.role).toBe('DRIVER');
      expect(res.body.membership).toMatchObject({
        serviceCode: 'RIDE',
        membershipRole: 'PROVIDER',
        status: 'PENDING_VERIFICATION',
      });
    });

    it('rejects a role mismatch — a driver phone signing in from the rider app', async () => {
      const phoneNumber = uniquePhone();
      expectStatus(await requestAndVerify(phoneNumber, 'EXECUTIVE_APP'), 201);

      // Bypass the resend cooldown directly — this test is about the role-check in
      // AuthService, not OtpService's cooldown (covered above).
      await redis.del(`otp:cooldown:${phoneNumber}`);
      const res = expectStatus(await requestAndVerify(phoneNumber, 'CONSUMER_APP'), 403);
      expect(res.body.message).toMatch(/registered as DRIVER/i);
    });

    it('enrolls the same account independently in a second service ("one login, many apps")', async () => {
      const phoneNumber = uniquePhone();
      const first = expectStatus(
        await requestAndVerify(phoneNumber, 'CONSUMER_APP', { serviceCode: 'RIDE' }),
        201,
      );

      await redis.del(`otp:cooldown:${phoneNumber}`);
      const second = expectStatus(
        await requestAndVerify(phoneNumber, 'CONSUMER_APP', { serviceCode: 'FIXIT' }),
        201,
      );

      expect(first.body.user.id).toBe(second.body.user.id);
      expect(first.body.membership.serviceCode).toBe('RIDE');
      expect(second.body.membership.serviceCode).toBe('FIXIT');
    });
  });

  describe('session lifecycle', () => {
    it('GET /auth/me rejects a request with no token', async () => {
      await request(server()).get('/api/v1/auth/me').expect(401);
    });

    it('GET /auth/me returns the profile + memberships for a valid session', async () => {
      const phoneNumber = uniquePhone();
      const { body } = expectStatus(await requestAndVerify(phoneNumber, 'CONSUMER_APP'), 201);

      const res = await request(server())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body.user.phoneNumber).toBe(phoneNumber);
      expect(res.body.memberships).toContainEqual(
        expect.objectContaining({ serviceCode: 'RIDE', membershipRole: 'CUSTOMER' }),
      );
    });

    it('refresh rotates the token and invalidates the old one', async () => {
      const phoneNumber = uniquePhone();
      const { body: signedUp } = expectStatus(
        await requestAndVerify(phoneNumber, 'CONSUMER_APP'),
        201,
      );

      const rotated = await request(server())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: signedUp.refreshToken })
        .expect(201);
      expect(rotated.body.accessToken).toBeDefined();
      expect(rotated.body.refreshToken).not.toBe(signedUp.refreshToken);

      // The token just replaced can't be reused (WhatsApp-style rotate-on-use).
      await request(server())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: signedUp.refreshToken })
        .expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const phoneNumber = uniquePhone();
      const { body } = expectStatus(await requestAndVerify(phoneNumber, 'CONSUMER_APP'), 201);

      await request(server())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: body.refreshToken })
        .expect(204);

      await request(server())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });
  });

  describe('profile', () => {
    it('PATCH /auth/me updates name/email/photo and reflects them back', async () => {
      const phoneNumber = uniquePhone();
      const { body: signedUp } = expectStatus(
        await requestAndVerify(phoneNumber, 'CONSUMER_APP'),
        201,
      );

      const res = await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${signedUp.accessToken}`)
        .send({
          firstName: 'Bhavya',
          lastName: 'Khatri',
          email: 'bhavya.khatri@obbian.com',
          profileImageUrl: 'https://example.com/avatar.jpg',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        firstName: 'Bhavya',
        lastName: 'Khatri',
        email: 'bhavya.khatri@obbian.com',
        profileImageUrl: 'https://example.com/avatar.jpg',
      });
    });

    it('PATCH /auth/me rejects an invalid email', async () => {
      const phoneNumber = uniquePhone();
      const { body: signedUp } = expectStatus(
        await requestAndVerify(phoneNumber, 'CONSUMER_APP'),
        201,
      );

      await request(server())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${signedUp.accessToken}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('PATCH /auth/me rejects a request with no token', async () => {
      await request(server()).patch('/api/v1/auth/me').send({ firstName: 'X' }).expect(401);
    });
  });

  describe('languages', () => {
    it('GET /auth/languages lists the supported onboarding languages, no auth required', async () => {
      const res = await request(server()).get('/api/v1/auth/languages').expect(200);
      expect(res.body.languages).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'hi-IN' })]),
      );
    });
  });
});
