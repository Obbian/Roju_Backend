import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import { Roles } from '../../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../../identity/guards/roles.guard';
import type { JwtPayload } from '../../identity/types/jwt-payload.type';
import { LocationPingDto } from './dto/location-ping.dto';
import { LocationIngestService } from './location.service';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationController {
  constructor(private readonly locationIngestService: LocationIngestService) {}

  @Post('ping')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ping(@CurrentUser() user: JwtPayload, @Body() dto: LocationPingDto): Promise<void> {
    await this.locationIngestService.recordPing(user.sub, dto);
  }
}
