import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { rideRoutePoints } from '../../db/schema';
import { LOCATION_ARCHIVE_QUEUE } from './location.service';

interface LocationPingJob {
  driverId: string;
  rideId: string | null;
  lat: number;
  lon: number;
  speedKmph?: number;
  headingDegrees?: number;
  accuracyMetres?: number;
  recordedAt: string;
}

// Cold-path consumer for the location-archive queue — writes raw GPS pings into
// ride_route_points for trip replay/audit. Runs seconds behind the live geo-cache by design;
// nothing on the matching/tracking hot path ever reads this table (HLD §6.2 data flow, §9).
@Processor(LOCATION_ARCHIVE_QUEUE)
export class LocationArchiveProcessor extends WorkerHost {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super();
  }

  async process(job: Job<LocationPingJob>): Promise<void> {
    const data = job.data;

    // No active ride tied to this ping (driver online but idle/unmatched) — nothing to
    // archive; ride_route_points only ever represents an in-progress trip's breadcrumb trail.
    if (!data.rideId) return;

    await this.db.insert(rideRoutePoints).values({
      rideId: data.rideId,
      driverId: data.driverId,
      lat: data.lat,
      lon: data.lon,
      speedKmph: data.speedKmph?.toString(),
      headingDegrees: data.headingDegrees,
      accuracyMetres: data.accuracyMetres,
      recordedAt: new Date(data.recordedAt),
    });
  }
}
