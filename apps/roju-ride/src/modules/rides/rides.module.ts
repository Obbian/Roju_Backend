import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MatchingModule } from '../matching/matching.module';
import { PricingModule } from '../pricing/pricing.module';
import { DirectionsService } from './directions.service';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({
  imports: [CatalogModule, PricingModule, MatchingModule],
  controllers: [RidesController],
  providers: [RidesService, DirectionsService],
})
export class RidesModule {}
