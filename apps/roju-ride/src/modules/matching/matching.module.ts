import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { MatchingBatchProcessor } from './matching-batch.processor';
import { MatchingTimeoutProcessor } from './matching-timeout.processor';
import { MatchingController } from './matching.controller';
import { MATCHING_BATCH_QUEUE, MATCHING_TIMEOUT_QUEUE, MatchingService } from './matching.service';

@Module({
  imports: [
    LocationModule,
    BullModule.registerQueue({ name: MATCHING_TIMEOUT_QUEUE }, { name: MATCHING_BATCH_QUEUE }),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingTimeoutProcessor, MatchingBatchProcessor],
  exports: [MatchingService],
})
export class MatchingModule {}
