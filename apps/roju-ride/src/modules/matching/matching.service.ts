import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { drivers, rides } from '../../db/schema';
import { REDIS } from '../../redis/redis.module';
import { LocationGeoCacheService } from '../location/location-geo-cache.service';

export const MATCHING_TIMEOUT_QUEUE = 'matching-timeout';

// Expanding-radius search, per docs/system-design-research.md §4.1. Two tiers for now —
// widen or make city-configurable once real usage data says the defaults are wrong.
const SEARCH_RADII_METERS = [3000, 8000];
const ACCEPT_WINDOW_SECONDS = 15;

interface PendingOffer {
  driverId: string;
  excludedDriverIds: string[];
}

function offerKey(rideId: string): string {
  return `matching:offer:${rideId}`;
}

// The Uber "DISCO" equivalent (HLD §5): finds a driver for a REQUESTED ride and drives it to
// ACCEPTED, offering one candidate at a time with a bounded accept window before falling
// through to the next. Scoring is nearest-only for now — weighting by rating/acceptance-rate
// is pending the client's Sheet 04/11 answer on matching priority.
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly geoCache: LocationGeoCacheService,
    @InjectQueue(MATCHING_TIMEOUT_QUEUE) private readonly timeoutQueue: Queue,
  ) {}

  async dispatch(rideId: string): Promise<void> {
    await this.attemptOffer(rideId, []);
  }

  async accept(rideId: string, driverId: string): Promise<void> {
    const offer = await this.getPendingOffer(rideId);
    if (!offer || offer.driverId !== driverId) {
      throw new ForbiddenException('No pending offer for this driver on this ride');
    }

    const ride = await this.getRide(rideId);
    if (ride.status !== 'MATCHING') {
      throw new ForbiddenException(`Ride is no longer accepting an offer (status: ${ride.status})`);
    }

    await this.db
      .update(rides)
      .set({ status: 'ACCEPTED', driverId, acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(rides.id, rideId));

    await this.db
      .update(drivers)
      .set({ offersAcceptedCount: sql`${drivers.offersAcceptedCount} + 1` })
      .where(eq(drivers.userId, driverId));

    await this.clearPendingOffer(rideId);
  }

  async reject(rideId: string, driverId: string): Promise<void> {
    const offer = await this.getPendingOffer(rideId);
    if (!offer || offer.driverId !== driverId) {
      throw new ForbiddenException('No pending offer for this driver on this ride');
    }

    await this.clearPendingOffer(rideId);
    await this.attemptOffer(rideId, [...offer.excludedDriverIds, driverId]);
  }

  // Invoked by MatchingTimeoutProcessor once an offer's accept window elapses.
  async handleTimeout(
    rideId: string,
    driverId: string,
    excludedDriverIds: string[],
  ): Promise<void> {
    const offer = await this.getPendingOffer(rideId);
    // Only proceed if this is still the *current* pending offer — an accept/reject that
    // already ran (clearing or replacing the key) wins the race, this timeout is stale.
    if (!offer || offer.driverId !== driverId) return;

    await this.clearPendingOffer(rideId);
    await this.attemptOffer(rideId, [...excludedDriverIds, driverId]);
  }

  private async attemptOffer(rideId: string, excludedDriverIds: string[]): Promise<void> {
    const ride = await this.getRide(rideId);

    if (ride.status !== 'REQUESTED' && ride.status !== 'MATCHING') {
      return; // cancelled or already resolved elsewhere — nothing to do
    }

    const candidate = await this.findNextCandidate(
      ride.rideType,
      ride.pickupLon,
      ride.pickupLat,
      excludedDriverIds,
    );

    if (!candidate) {
      await this.db
        .update(rides)
        .set({
          status: 'CANCELLED',
          cancellationReason: 'NO_DRIVER_FOUND',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rides.id, rideId));
      this.logger.warn(
        `No driver found for ride ${rideId} after ${excludedDriverIds.length} attempt(s)`,
      );
      return;
    }

    await this.db
      .update(rides)
      .set({ status: 'MATCHING', updatedAt: new Date() })
      .where(eq(rides.id, rideId));

    await this.db
      .update(drivers)
      .set({ offersReceivedCount: sql`${drivers.offersReceivedCount} + 1` })
      .where(eq(drivers.userId, candidate.driverId));

    await this.setPendingOffer(rideId, { driverId: candidate.driverId, excludedDriverIds });

    await this.timeoutQueue.add(
      'offer-timeout',
      { rideId, driverId: candidate.driverId, excludedDriverIds },
      { delay: ACCEPT_WINDOW_SECONDS * 1000, removeOnComplete: true, removeOnFail: true },
    );
  }

  private async findNextCandidate(
    vehicleType: string,
    lon: number,
    lat: number,
    excludedDriverIds: string[],
  ): Promise<{ driverId: string; distanceMeters: number } | null> {
    const excluded = new Set(excludedDriverIds);

    for (const radius of SEARCH_RADII_METERS) {
      const nearby = await this.geoCache.searchNearby(vehicleType, lon, lat, radius);
      const eligible = nearby.filter((candidate) => !excluded.has(candidate.driverId));
      if (eligible.length > 0) {
        return eligible[0];
      }
    }

    return null;
  }

  private async getRide(rideId: string) {
    const ride = await this.db.query.rides.findFirst({ where: eq(rides.id, rideId) });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    return ride;
  }

  private async getPendingOffer(rideId: string): Promise<PendingOffer | null> {
    const raw = await this.redis.get(offerKey(rideId));
    return raw ? (JSON.parse(raw) as PendingOffer) : null;
  }

  private async setPendingOffer(rideId: string, offer: PendingOffer): Promise<void> {
    await this.redis.set(offerKey(rideId), JSON.stringify(offer), 'EX', ACCEPT_WINDOW_SECONDS + 5);
  }

  private async clearPendingOffer(rideId: string): Promise<void> {
    await this.redis.del(offerKey(rideId));
  }
}
