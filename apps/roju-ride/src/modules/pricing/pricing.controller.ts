import { Controller, Get, Query } from '@nestjs/common';
import { EstimateFareQueryDto } from './dto/estimate-fare-query.dto';
import { PricingService } from './pricing.service';

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
    );
  }
}
