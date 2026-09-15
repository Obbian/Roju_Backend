import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { WeatherService } from './weather.service';

@Module({
  controllers: [PricingController],
  providers: [PricingService, WeatherService],
  exports: [PricingService],
})
export class PricingModule {}
