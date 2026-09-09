import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { MatchingService } from './matching.service';

@Controller('matching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post(':rideId/accept')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async accept(@Param('rideId') rideId: string, @CurrentUser() user: JwtPayload): Promise<void> {
    await this.matchingService.accept(rideId, user.sub);
  }

  @Post(':rideId/reject')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reject(@Param('rideId') rideId: string, @CurrentUser() user: JwtPayload): Promise<void> {
    await this.matchingService.reject(rideId, user.sub);
  }
}
