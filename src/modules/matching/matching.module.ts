import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LocationModule } from '../location/location.module';
import { MatchingTimeoutProcessor } from './matching-timeout.processor';
import { MatchingController } from './matching.controller';
import { MATCHING_TIMEOUT_QUEUE, MatchingService } from './matching.service';

@Module({
  imports: [AuthModule, LocationModule, BullModule.registerQueue({ name: MATCHING_TIMEOUT_QUEUE })],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingTimeoutProcessor],
  exports: [MatchingService],
})
export class MatchingModule {}
