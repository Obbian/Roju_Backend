import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SUPPORTED_LANGUAGES } from './languages';
import type { JwtPayload } from './types/jwt-payload.type';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestOtp(@Body() dto: RequestOtpDto): Promise<void> {
    await this.authService.requestOtp(dto.phoneNumber);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.verifyOtp(
      dto.phoneNumber,
      dto.otp,
      dto.registeredVia,
      dto.serviceCode,
      dto.preferredLanguage,
      userAgent,
    );
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  // Splash-screen call: a stored access token (or one just refreshed) that resolves here
  // means the device stays signed in — no OTP prompt.
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.sub, dto);
  }

  // Backend-exposed so the onboarding language-picker screen never ships its own copy of
  // this list — no guard, no account required, matches the pre-signup point it's used at.
  @Get('languages')
  languages() {
    return { languages: SUPPORTED_LANGUAGES };
  }
}
