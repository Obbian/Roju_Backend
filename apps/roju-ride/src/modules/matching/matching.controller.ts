import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import { Roles } from '../../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../../identity/guards/roles.guard';
import type { JwtPayload } from '../../identity/types/jwt-payload.type';
import { MatchingService } from './matching.service';

@ApiTags('Matching')
@ApiBearerAuth()
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
