import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'refreshToken returned by Verify OTP or a prior Refresh call' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
