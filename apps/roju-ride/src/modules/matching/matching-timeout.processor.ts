import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MATCHING_TIMEOUT_QUEUE, MatchingService } from './matching.service';

interface OfferTimeoutJob {
  rideId: string;
  driverId: string;
  excludedDriverIds: string[];
}

@Processor(MATCHING_TIMEOUT_QUEUE)
export class MatchingTimeoutProcessor extends WorkerHost {
  constructor(private readonly matchingService: MatchingService) {
    super();
  }

  async process(job: Job<OfferTimeoutJob>): Promise<void> {
    const { rideId, driverId, excludedDriverIds } = job.data;
    await this.matchingService.handleTimeout(rideId, driverId, excludedDriverIds);
  }
}
