import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { drivers } from '../../db/schema';
import { LocationGeoCacheService } from './location-geo-cache.service';
import type { LocationPingDto } from './dto/location-ping.dto';

export const LOCATION_ARCHIVE_QUEUE = 'location-archive';

// The Uber "Supply Service" equivalent (HLD §5): every ping does exactly two things —
// update the live geo-cache synchronously (the hot path Matching reads), and enqueue the
// raw point for archival asynchronously (the cold path, batched by LocationArchiveProcessor).
// Never writes ride_route_points directly on the request path — see HLD §9 for why.
@Injectable()
export class LocationIngestService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly geoCache: LocationGeoCacheService,
    @InjectQueue(LOCATION_ARCHIVE_QUEUE) private readonly archiveQueue: Queue,
  ) {}

  async recordPing(driverId: string, ping: LocationPingDto): Promise<void> {
    const driver = await this.db.query.drivers.findFirst({
      where: eq(drivers.userId, driverId),
    });

    if (!driver || driver.status !== 'ONLINE') {
      throw new ForbiddenException('Driver must be ONLINE to send location pings');
    }

    await this.geoCache.upsert(driver.vehicleType, driverId, ping.lon, ping.lat);

    await this.archiveQueue.add(
      'ping',
      {
        driverId,
        rideId: ping.rideId ?? null,
        lat: ping.lat,
        lon: ping.lon,
        speedKmph: ping.speedKmph,
        headingDegrees: ping.headingDegrees,
        accuracyMetres: ping.accuracyMetres,
        recordedAt: new Date().toISOString(),
      },
      { removeOnComplete: true, removeOnFail: 100 },
    );
  }
}
