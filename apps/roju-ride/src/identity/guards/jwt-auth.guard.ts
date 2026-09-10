import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../types/jwt-payload.type';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

// This app never issues its own tokens — it only verifies ones signed by roju-identity,
// using the access secret both services share (see HLD: identity extraction). No network
// call per request; verification is local via the shared secret/key, same as before.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.user = this.jwt.verify<JwtPayload>(authHeader.slice('Bearer '.length), {
        secret: this.config.getOrThrow<string>('auth.accessSecret'),
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
