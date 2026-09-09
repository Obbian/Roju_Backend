import { ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisteredVia } from './dto/registered-via.enum';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
function expectedRoleFor(registeredVia: RegisteredVia): 'RIDER' | 'DRIVER' {
  return registeredVia === RegisteredVia.EXECUTIVE_APP ? 'DRIVER' : 'RIDER';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  requestOtp(phoneNumber: string): Promise<void> {
    return this.otpService.requestOtp(phoneNumber);
  }

  async verifyOtp(
    phoneNumber: string,
    otp: string,
    registeredVia: RegisteredVia,
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
      user = await this.usersService.createByPhone(phoneNumber, expectedRole, registeredVia);
    }

    if (user.accountStatus !== 'ACTIVE') {
      throw new ForbiddenException(`Account is ${user.accountStatus.toLowerCase()}`);
    }

    await this.usersService.markLoggedIn(user.id);

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    });
    const refreshToken = await this.tokenService.issueRefreshToken(user.id, deviceInfo);

    return { accessToken, refreshToken, user: this.usersService.toPublicUser(user) };
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
}
