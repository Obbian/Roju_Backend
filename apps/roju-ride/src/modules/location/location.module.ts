import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LocationArchiveProcessor } from './location-archive.processor';
import { LocationGeoCacheService } from './location-geo-cache.service';
import { LocationController } from './location.controller';
import { LOCATION_ARCHIVE_QUEUE, LocationIngestService } from './location.service';

@Module({
  imports: [BullModule.registerQueue({ name: LOCATION_ARCHIVE_QUEUE })],
  controllers: [LocationController],
  providers: [LocationGeoCacheService, LocationIngestService, LocationArchiveProcessor],
  exports: [LocationGeoCacheService],
})
export class LocationModule {}
