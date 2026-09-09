import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { refreshTokens } from '../../db/schema';
import type { JwtPayload } from './types/jwt-payload.type';

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

function parseExpiryToSeconds(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 900;
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('auth.accessSecret'),
      expiresIn: this.config.get<string>('auth.accessExpiresIn') ?? '15m',
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('auth.accessSecret'),
    });
  }

  async issueRefreshToken(userId: string, deviceInfo?: string): Promise<string> {
    const rawToken = randomBytes(48).toString('hex');
    const ttlSeconds = parseExpiryToSeconds(
      this.config.get<string>('auth.refreshExpiresIn') ?? '30d',
    );

    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      deviceInfo,
    });

    return rawToken;
  }

  async rotateRefreshToken(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), rotatedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id));

    const refreshToken = await this.issueRefreshToken(
      existing.userId,
      existing.deviceInfo ?? undefined,
    );

    return { userId: existing.userId, refreshToken };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(rawToken)));
  }
}
