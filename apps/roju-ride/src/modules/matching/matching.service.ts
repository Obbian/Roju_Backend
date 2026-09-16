import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { drivers, rides, rushAreas } from '../../db/schema';
import { REDIS } from '../../redis/redis.module';
import { LocationGeoCacheService, type NearbyDriver } from '../location/location-geo-cache.service';
import { padToSquare, solveAssignment } from './hungarian-algorithm';

export const MATCHING_TIMEOUT_QUEUE = 'matching-timeout';
export const MATCHING_BATCH_QUEUE = 'matching-batch';

// Expanding-radius search, per docs/system-design-research.md §4.1. Default for any city
// without its own rule below.
const DEFAULT_SEARCH_RADII_METERS = [3000, 8000];

// Hyderabad-specific radii, per senior's brief (2026-09-15): a handful of high-demand
// localities get a tighter first pass since driver density there is much higher, everywhere
// else in the city goes straight to the wider radius, and nothing in Hyderabad searches past
// 5km even as a fallback. The *areas themselves* are NOT hardcoded here (per the follow-up
// brief) — they live in the rush_areas table, added/removed/resized by editing rows, not
// deploying code. See RushArea below and findRushAreas().
const HYDERABAD_CITY = 'Hyderabad';
// Case 1 (rush localities): tight 1.5km first; Case 3 (fallback, any Hyderabad pickup):
// widen to 5km max if nothing turned up.
const HYDERABAD_RUSH_SEARCH_RADII_METERS = [1500, 5000];
// Case 2 (rest of Hyderabad): go straight to 5km — already Case 3's ceiling, so there's
// nothing further to expand to.
const HYDERABAD_DEFAULT_SEARCH_RADII_METERS = [5000];

const ACCEPT_WINDOW_SECONDS = 15;

interface RushArea {
  lat: number;
  lon: number;
  catchmentRadiusMeters: number;
}

// Exported for matching.service.spec.ts — pure, no NestJS/DB/Redis wiring needed to test them.
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// `areas` is passed in (not fetched here) so this stays a pure, DB-free function to unit test.
export function isRushPickup(lat: number, lon: number, areas: RushArea[]): boolean {
  return areas.some(
    (area) => haversineMeters(lat, lon, area.lat, area.lon) <= area.catchmentRadiusMeters,
  );
}

export function radiiForCity(city: string, isRush: boolean): number[] {
  if (city !== HYDERABAD_CITY) return DEFAULT_SEARCH_RADII_METERS;
  return isRush ? HYDERABAD_RUSH_SEARCH_RADII_METERS : HYDERABAD_DEFAULT_SEARCH_RADII_METERS;
}

// Uber's own writeup on Marketplace matching: "if we wait just a few seconds after a
// request, it can make a big difference" — batching a short window of requests together and
// solving them as one assignment problem (below) beats matching each request the instant it
// arrives, because the instant-match approach can hand a ride's best driver to whichever
// *other* ride happened to be created a few hundred milliseconds earlier.
const BATCH_INTERVAL_MS = 3000;
// Bound on how long a ride sits unmatched before giving up — same "No Ride Found" outcome
// the old single-request path had, just resolved on the next batch tick instead of instantly.
const MAX_MATCH_WAIT_MS = 45_000;
// Sentinel cost for "this driver was never a candidate for this ride" (out of both search
// radii) — large enough that the solver only picks it when there's truly no real option.
const UNREACHABLE_COST = 1e9;

interface PendingOffer {
  driverId: string;
  excludedDriverIds: string[];
}

function offerKey(rideId: string): string {
  return `matching:offer:${rideId}`;
}

// The Uber "DISCO" equivalent (HLD §5), now matching its actual published approach rather
// than a simplified stand-in: a short batch window collects every pending REQUESTED ride,
// builds a cost matrix against every candidate driver (pickup distance), and solves it as one
// assignment problem via the Hungarian algorithm — the same technique Uber's Marketplace
// batch-matching uses (Order-Driver matrix + Hungarian algorithm) to minimize total pickup
// distance across the whole batch, not just each ride considered in isolation. This is what
// actually addresses DISCO's "reduce extra driving" goal — greedy nearest-first only ever
// optimizes one ride at a time and can leave a much larger total distance across the batch.
//
// Re-offering after a reject/timeout still falls through to the simpler nearest-candidate
// path (attemptOffer) rather than re-running the batch solver — re-optimizing the whole batch
// on every single decline is unnecessary complexity for a problem this method already solves
// well enough (find the next-best driver for just the one ride that got rejected).
@Injectable()
export class MatchingService implements OnModuleInit {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly geoCache: LocationGeoCacheService,
    @InjectQueue(MATCHING_TIMEOUT_QUEUE) private readonly timeoutQueue: Queue,
    @InjectQueue(MATCHING_BATCH_QUEUE) private readonly batchQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Stable jobId makes this idempotent across restarts/hot-reloads — BullMQ won't create a
    // second repeatable tick for the same id.
    await this.batchQueue.add(
      'tick',
      {},
      { repeat: { every: BATCH_INTERVAL_MS }, jobId: 'matching-batch-tick' },
    );
  }

  // Ride creation no longer dispatches synchronously — the ride is already persisted as
  // REQUESTED, and the next batch tick (at most BATCH_INTERVAL_MS away) will consider it
  // together with every other pending request. Kept as a named entry point so RidesService's
  // call site doesn't need to know batching exists.
  async dispatch(rideId: string): Promise<void> {
    this.logger.debug(`Ride ${rideId} queued for the next batch-matching tick`);
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
    await this.releaseToOnline(driverId);
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
    await this.releaseToOnline(driverId);
    await this.attemptOffer(rideId, [...excludedDriverIds, driverId]);
  }

  // Invoked every BATCH_INTERVAL_MS by MatchingBatchProcessor. Groups pending rides by
  // vehicleType (drivers only ever serve one category) since cross-category matching is
  // meaningless, and solves each group as its own assignment problem.
  async runBatchCycle(): Promise<void> {
    const pending = await this.db.query.rides.findMany({ where: eq(rides.status, 'REQUESTED') });
    if (pending.length === 0) return;

    const groups = new Map<string, typeof pending>();
    for (const ride of pending) {
      const group = groups.get(ride.rideType);
      if (group) {
        group.push(ride);
      } else {
        groups.set(ride.rideType, [ride]);
      }
    }

    for (const [vehicleType, groupRides] of groups) {
      await this.matchGroup(vehicleType, groupRides);
    }
  }

  private async matchGroup(
    vehicleType: string,
    groupRides: (typeof rides.$inferSelect)[],
  ): Promise<void> {
    const candidatesByRide = new Map<string, NearbyDriver[]>();
    for (const ride of groupRides) {
      candidatesByRide.set(
        ride.id,
        await this.findCandidates(vehicleType, ride.city, ride.pickupLon, ride.pickupLat),
      );
    }

    const driverIds = [
      ...new Set(
        [...candidatesByRide.values()].flatMap((candidates) => candidates.map((c) => c.driverId)),
      ),
    ];

    const matchedRideIds = new Set<string>();

    if (driverIds.length > 0) {
      const rawCost = groupRides.map((ride) => {
        const byDriver = new Map(
          candidatesByRide.get(ride.id)!.map((c) => [c.driverId, c.distanceMeters]),
        );
        return driverIds.map((driverId) => byDriver.get(driverId) ?? UNREACHABLE_COST);
      });

      // Hungarian algorithm needs a square matrix — pad the smaller side (usually driver
      // count, since ride requests outnumber idle-and-nearby drivers at peak) with the same
      // "unreachable" sentinel so padding never gets preferred over a real pairing.
      const cost = padToSquare(rawCost, UNREACHABLE_COST);
      const assignment = solveAssignment(cost);

      for (let i = 0; i < groupRides.length; i++) {
        const driverIndex = assignment[i];
        if (driverIndex === undefined || driverIndex === -1 || driverIndex >= driverIds.length)
          continue;
        if (cost[i][driverIndex] >= UNREACHABLE_COST) continue; // padding/unreachable, not a real match

        await this.commitOffer(groupRides[i].id, driverIds[driverIndex], []);
        matchedRideIds.add(groupRides[i].id);
      }
    }

    await this.expireStaleRequests(groupRides.filter((r) => !matchedRideIds.has(r.id)));
  }

  // Rides that have gone unmatched past MAX_MATCH_WAIT_MS give up — same "No Ride Found"
  // outcome as before, just decided on a batch tick instead of the instant the ride was
  // created (there was never a real driver in range in either case).
  private async expireStaleRequests(unmatchedRides: (typeof rides.$inferSelect)[]): Promise<void> {
    const now = Date.now();
    for (const ride of unmatchedRides) {
      if (now - ride.createdAt.getTime() < MAX_MATCH_WAIT_MS) continue;

      await this.db
        .update(rides)
        .set({
          status: 'CANCELLED',
          cancellationReason: 'NO_DRIVER_FOUND',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rides.id, ride.id));
      this.logger.warn(`No driver found for ride ${ride.id} within ${MAX_MATCH_WAIT_MS}ms`);
    }
  }

  // The reject/timeout re-offer path — deliberately simpler than the batch solver above (see
  // class comment): just the next-nearest remaining candidate for this one ride.
  private async attemptOffer(rideId: string, excludedDriverIds: string[]): Promise<void> {
    const ride = await this.getRide(rideId);
    if (ride.status !== 'REQUESTED' && ride.status !== 'MATCHING') {
      return; // cancelled or already resolved elsewhere — nothing to do
    }

    const candidates = await this.findCandidates(
      ride.rideType,
      ride.city,
      ride.pickupLon,
      ride.pickupLat,
    );
    const candidate = candidates.find((c) => !excludedDriverIds.includes(c.driverId));

    if (!candidate) {
      // Back to REQUESTED (if not already) so the next batch tick gives it another chance
      // against the current driver pool, rather than giving up on the first exhausted offer.
      await this.db
        .update(rides)
        .set({ status: 'REQUESTED', updatedAt: new Date() })
        .where(eq(rides.id, rideId));
      return;
    }

    await this.commitOffer(rideId, candidate.driverId, excludedDriverIds);
  }

  // Shared tail for both the batch assignment and the single-candidate fallthrough: flip the
  // ride to MATCHING, count the offer, stash it in Redis, and start its accept-window clock.
  private async commitOffer(
    rideId: string,
    driverId: string,
    excludedDriverIds: string[],
  ): Promise<void> {
    await this.db
      .update(rides)
      .set({ status: 'MATCHING', updatedAt: new Date() })
      .where(eq(rides.id, rideId));

    // Reserved the instant they're offered, not just once they accept — this is what makes
    // findCandidates' ONLINE filter actually prevent a driver being offered a second ride
    // while this one is still pending.
    await this.db
      .update(drivers)
      .set({ status: 'ON_RIDE', offersReceivedCount: sql`${drivers.offersReceivedCount} + 1` })
      .where(eq(drivers.userId, driverId));

    await this.setPendingOffer(rideId, { driverId, excludedDriverIds });

    await this.timeoutQueue.add(
      'offer-timeout',
      { rideId, driverId, excludedDriverIds },
      { delay: ACCEPT_WINDOW_SECONDS * 1000, removeOnComplete: true, removeOnFail: true },
    );
  }

  // Frees a driver who declined (or never responded to) an offer back into the ONLINE pool —
  // they didn't accept, so unlike a driver mid-trip they're immediately available again.
  private async releaseToOnline(driverId: string): Promise<void> {
    await this.db.update(drivers).set({ status: 'ONLINE' }).where(eq(drivers.userId, driverId));
  }

  // Called by RidesService when a ride is cancelled — releases whatever driver currently has
  // this ride's pending offer (if any) back to ONLINE and clears the offer, so a rider
  // cancelling doesn't leave a driver permanently stuck reserved for a ride that no longer
  // exists. A no-op if there's no pending offer (e.g. the ride was never matched, or the
  // driver had already accepted — RidesService handles releasing an accepted driver itself
  // since at that point it's the one holding rides.driverId).
  async releasePendingOffer(rideId: string): Promise<void> {
    const offer = await this.getPendingOffer(rideId);
    if (!offer) return;

    await this.clearPendingOffer(rideId);
    await this.releaseToOnline(offer.driverId);
  }

  // A driver stays in the geo-cache continuously (it only tracks "online and where"), so a
  // driver who already has a pending offer or an active ride must be filtered out here —
  // otherwise the same driver can surface as a candidate for a second ride before they've
  // responded to (or even started) the first one. commitOffer() below is what flips a driver
  // out of ONLINE the moment they're offered anything, making this filter actually bite.
  private async findCandidates(
    vehicleType: string,
    city: string,
    lon: number,
    lat: number,
  ): Promise<NearbyDriver[]> {
    for (const radius of await this.searchRadiiFor(city, lat, lon)) {
      const nearby = await this.geoCache.searchNearby(vehicleType, lon, lat, radius);
      if (nearby.length === 0) continue;

      const available = await this.db.query.drivers.findMany({
        where: inArray(
          drivers.userId,
          nearby.map((c) => c.driverId),
        ),
        columns: { userId: true, status: true },
      });
      const onlineIds = new Set(
        available.filter((d) => d.status === 'ONLINE').map((d) => d.userId),
      );
      const filtered = nearby.filter((c) => onlineIds.has(c.driverId));

      if (filtered.length > 0) return filtered;
    }
    return [];
  }

  // Reads rush_areas from the DB rather than a hardcoded list (2026-09-15 follow-up brief) —
  // new areas, removals, and per-area radius tweaks are a row edit, not a deploy.
  private async searchRadiiFor(city: string, lat: number, lon: number): Promise<number[]> {
    const areas = await this.db.query.rushAreas.findMany({
      where: and(eq(rushAreas.city, city), eq(rushAreas.isActive, true)),
      columns: { lat: true, lon: true, catchmentRadiusMeters: true },
    });
    return radiiForCity(city, isRushPickup(lat, lon, areas));
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
