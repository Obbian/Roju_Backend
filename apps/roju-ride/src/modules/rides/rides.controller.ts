import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
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

const RIDER_TAG = 'Rides (Rider)';
const DRIVER_TAG = 'Rides (Driver)';

// No class-level @ApiTags here on purpose — each method below carries its own tag(s) so the
// rider-side and driver-side halves of this same controller show up as separate, flow-ordered
// groups in Swagger UI instead of one undifferentiated "Rides" bucket.
@ApiBearerAuth()
@Controller('rides')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @ApiTags(RIDER_TAG)
  @Post()
  @Roles('RIDER')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRideDto) {
    return this.ridesService.create(user.sub, dto);
  }

  @ApiTags(RIDER_TAG)
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
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

  // Either party on the ride can look it up — shown under both groups.
  @ApiTags(RIDER_TAG, DRIVER_TAG)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.findById(id, user.sub);
  }

  @ApiTags(RIDER_TAG)
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
  // inside RidesService, not by role here. Shown under both groups for the same reason.
  @ApiTags(RIDER_TAG, DRIVER_TAG)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CancelRideDto) {
    return this.ridesService.cancel(id, user.sub, dto);
  }

  // Both sides rate each other with this same endpoint (see RidesService.rate).
  @ApiTags(RIDER_TAG, DRIVER_TAG)
  @Post(':id/rate')
  rate(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: RateRideDto) {
    return this.ridesService.rate(id, user.sub, dto);
  }

  @ApiTags(DRIVER_TAG)
  @Post(':id/arrive')
  @Roles('DRIVER')
  arrive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.arrive(id, user.sub);
  }

  @ApiTags(DRIVER_TAG)
  @Post(':id/start')
  @Roles('DRIVER')
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.start(id, user.sub);
  }

  @ApiTags(DRIVER_TAG)
  @Post(':id/complete')
  @Roles('DRIVER')
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ridesService.complete(id, user.sub);
  }
}
