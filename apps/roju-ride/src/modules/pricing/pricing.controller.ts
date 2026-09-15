import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EstimateFareQueryDto } from './dto/estimate-fare-query.dto';
import { PricingService } from './pricing.service';

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('estimate')
  estimate(@Query() query: EstimateFareQueryDto) {
    return this.pricingService.estimateFare(
      query.city,
      query.rideType,
      query.distanceKm,
      query.durationMin,
      query.pickupLat,
      query.pickupLon,
    );
  }
}
