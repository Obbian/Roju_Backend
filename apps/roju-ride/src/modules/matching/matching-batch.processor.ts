import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MATCHING_BATCH_QUEUE, MatchingService } from './matching.service';

@Processor(MATCHING_BATCH_QUEUE)
export class MatchingBatchProcessor extends WorkerHost {
  constructor(private readonly matchingService: MatchingService) {
    super();
  }

  async process(): Promise<void> {
    await this.matchingService.runBatchCycle();
  }
}
