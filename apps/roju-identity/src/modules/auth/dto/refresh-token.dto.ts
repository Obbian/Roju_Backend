import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: '0b1f7c58ca4d287ff48bb700a1dd5d3536775cb733477ef749dd38c43c27cf0796966220ac64ff1e4151e7b7003e9cd4',
    description: 'refreshToken returned by Verify OTP or a prior Refresh call',
  })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
