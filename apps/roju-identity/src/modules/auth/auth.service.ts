import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipsService } from '../memberships/memberships.service';
import { UsersService } from '../users/users.service';
import { RegisteredVia } from './dto/registered-via.enum';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

const DEFAULT_SERVICE_CODE = 'RIDE';

function expectedRoleFor(registeredVia: RegisteredVia): 'RIDER' | 'DRIVER' {
  return registeredVia === RegisteredVia.EXECUTIVE_APP ? 'DRIVER' : 'RIDER';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly membershipsService: MembershipsService,
  ) {}

  requestOtp(phoneNumber: string): Promise<void> {
    return this.otpService.requestOtp(phoneNumber);
  }

  async verifyOtp(
    phoneNumber: string,
    otp: string,
    registeredVia: RegisteredVia,
    serviceCode: string = DEFAULT_SERVICE_CODE,
    preferredLanguage?: string,
    deviceInfo?: string,
  ) {
    await this.otpService.verifyOtp(phoneNumber, otp);

    const expectedRole = expectedRoleFor(registeredVia);
    let user = await this.usersService.findByPhone(phoneNumber);

    if (user && user.role !== expectedRole) {
      throw new ForbiddenException(
        `This phone number is registered as ${user.role} — sign in from the matching app`,
      );
    }

    if (!user) {
      user = await this.usersService.createByPhone(
        phoneNumber,
        expectedRole,
        registeredVia,
        preferredLanguage,
      );
    } else if (preferredLanguage && preferredLanguage !== user.preferredLanguage) {
      await this.usersService.setPreferredLanguage(user.id, preferredLanguage);
      user.preferredLanguage = preferredLanguage;
    }

    if (user.accountStatus !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${user.accountStatus.toLowerCase()}`);
    }

    await this.usersService.markLoggedIn(user.id);

    // The actual "one login, many apps" mechanism: every service the account touches gets
    // its own enrollment row, independent of the others (see MembershipsService).
    const membership = await this.membershipsService.ensureMembership(
      user.id,
      serviceCode,
      expectedRole === 'DRIVER' ? 'PROVIDER' : 'CUSTOMER',
    );

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    });
    // Long-lived and rotated on every use (see TokenService.rotateRefreshToken) — a device
    // that keeps opening the app stays signed in indefinitely, WhatsApp-style; only an
    // expired/revoked/never-used-again token forces OTP verification again.
    const refreshToken = await this.tokenService.issueRefreshToken(user.id, deviceInfo);

    return {
      accessToken,
      refreshToken,
      user: this.usersService.toPublicUser(user),
      membership: membership && {
        serviceCode: membership.serviceCode,
        membershipRole: membership.membershipRole,
        status: membership.status,
      },
    };
  }

  async refresh(rawRefreshToken: string) {
    const { userId, refreshToken } = await this.tokenService.rotateRefreshToken(rawRefreshToken);
    const user = await this.usersService.findById(userId);

    if (!user || user.accountStatus !== 'ACTIVE') {
      throw new ForbiddenException('Account is no longer active');
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    });

    return { accessToken, refreshToken };
  }

  logout(rawRefreshToken: string): Promise<void> {
    return this.tokenService.revokeRefreshToken(rawRefreshToken);
  }

  // The splash-screen check: validates the still-signed-in session and returns the profile
  // (+ every app the account is enrolled in) in one call, so the app can skip straight past
  // the OTP flow entirely.
  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.accountStatus !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${user.accountStatus.toLowerCase()}`);
    }

    const memberships = await this.membershipsService.listForUser(userId);

    return {
      user: this.usersService.toPublicUser(user),
      memberships: memberships.map((m) => ({
        serviceCode: m.serviceCode,
        membershipRole: m.membershipRole,
        status: m.status,
      })),
    };
  }
}
