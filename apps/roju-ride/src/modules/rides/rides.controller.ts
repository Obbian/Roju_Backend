import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import { Roles } from '../../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../../identity/guards/roles.guard';
import type { JwtPayload } from '../../identity/types/jwt-payload.type';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { UpdateRideStopsDto } from './dto/update-ride-stops.dto';
import { RidesService } from './rides.service';

@Controller('rides')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @Roles('RIDER')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRideDto) {
    return this.ridesService.create(user.sub, dto);
  }

  @Get()
  @Roles('RIDER')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ridesService.listForRider(
      user.sub,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.findById(id, user.sub);
  }

  @Patch(':id/stops')
  @Roles('RIDER')
  updateStops(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRideStopsDto,
  ) {
    return this.ridesService.updateStops(id, user.sub, dto);
  }

  // Cancellable by whichever party is on the ride (rider or driver) — ownership is enforced
  // inside RidesService, not by role here.
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CancelRideDto) {
    return this.ridesService.cancel(id, user.sub, dto);
  }

  @Post(':id/rate')
  rate(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RateRideDto) {
    return this.ridesService.rate(id, user.sub, dto);
  }

  @Post(':id/arrive')
  @Roles('DRIVER')
  arrive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.arrive(id, user.sub);
  }

  @Post(':id/start')
  @Roles('DRIVER')
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.start(id, user.sub);
  }

  @Post(':id/complete')
  @Roles('DRIVER')
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.complete(id, user.sub);
  }
}
