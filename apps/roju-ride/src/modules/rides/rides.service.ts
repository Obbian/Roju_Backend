import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { cancellationPenalties, rideReviews, rides } from '../../db/schema';
import type { rideStatus } from '../../db/schema/enums';
import { CatalogService } from '../catalog/catalog.service';
import { MatchingService } from '../matching/matching.service';
import { PricingService } from '../pricing/pricing.service';
import type { CancelRideDto } from './dto/cancel-ride.dto';
import type { CreateRideDto } from './dto/create-ride.dto';
import type { RateRideDto } from './dto/rate-ride.dto';

type RideStatus = (typeof rideStatus.enumValues)[number];

// Pending self-hosted OSRM integration (HLD §5, §9) — straight-line distance stands in for a
// real route until then, so booking works end-to-end without blocking on that integration.
const PLACEHOLDER_AVG_SPEED_KMPH = 25;

// Draft escalation tiers (index = prior chargeable cancellations in the window), pending the
// client's Sheet 02 answer. docs/system-design-research.md §4.4.
const CANCELLATION_WINDOW_HOURS = 24;
const CANCELLATION_PENALTY_TIERS_PAISE = [0, 2000, 4000, 6000];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

@Injectable()
export class RidesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly catalogService: CatalogService,
    private readonly pricingService: PricingService,
    private readonly matchingService: MatchingService,
  ) {}

  async create(riderId: string, dto: CreateRideDto) {
    const category = await this.catalogService.findAvailableCategory(dto.rideType, dto.city);
    if (!category) {
      throw new NotFoundException(`${dto.rideType} is not available in ${dto.city}`);
    }

    const distanceKm = haversineKm(dto.pickupLat, dto.pickupLon, dto.dropoffLat, dto.dropoffLon);
    const durationMin = Math.round((distanceKm / PLACEHOLDER_AVG_SPEED_KMPH) * 60);

    const estimate = await this.pricingService.estimateFare(
      dto.city,
      dto.rideType,
      distanceKm,
      durationMin,
    );

    const [ride] = await this.db
      .insert(rides)
      .values({
        riderId,
        rideType: dto.rideType,
        city: dto.city,
        pickupLat: dto.pickupLat,
        pickupLon: dto.pickupLon,
        pickupAddress: dto.pickupAddress,
        dropoffLat: dto.dropoffLat,
        dropoffLon: dto.dropoffLon,
        dropoffAddress: dto.dropoffAddress,
        estimatedFare: estimate.estimatedFare.toString(),
        surgeMultiplier: estimate.surgeMultiplier.toString(),
        distanceKm: distanceKm.toString(),
        durationMin,
        passengerName: dto.passengerName,
        passengerPhone: dto.passengerPhone,
        promoCode: dto.promoCode,
        bookingChannel: 'HUMAN',
      })
      .returning();

    await this.matchingService.dispatch(ride.id);

    return this.findById(ride.id, riderId);
  }

  async findById(rideId: string, requesterId: string) {
    const ride = await this.db.query.rides.findFirst({ where: eq(rides.id, rideId) });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.riderId !== requesterId && ride.driverId !== requesterId) {
      throw new ForbiddenException('Not part of this ride');
    }
    return ride;
  }

  async listForRider(riderId: string, limit = 20, offset = 0) {
    return this.db.query.rides.findMany({
      where: eq(rides.riderId, riderId),
      orderBy: [desc(rides.createdAt)],
      limit,
      offset,
    });
  }

  async cancel(rideId: string, requesterId: string, dto: CancelRideDto) {
    const ride = await this.findById(rideId, requesterId);

    if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') {
      throw new ForbiddenException(`Cannot cancel a ride that is already ${ride.status}`);
    }

    const role = ride.riderId === requesterId ? 'RIDER' : 'DRIVER';
    const minutesSinceRequest = (Date.now() - ride.createdAt.getTime()) / 60000;
    const offenceIndex = await this.countRecentOffences(requesterId);
    const penaltyPaise =
      CANCELLATION_PENALTY_TIERS_PAISE[
        Math.min(offenceIndex, CANCELLATION_PENALTY_TIERS_PAISE.length - 1)
      ];

    await this.db.insert(cancellationPenalties).values({
      userId: requesterId,
      rideId,
      role,
      reason: dto.reason,
      offenceIndex: offenceIndex + 1,
      penaltyPaise,
      minutesSinceRequest: minutesSinceRequest.toString(),
    });

    await this.db
      .update(rides)
      .set({
        status: 'CANCELLED',
        cancellationReason: dto.reason,
        cancellationFee: (penaltyPaise / 100).toString(),
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rides.id, rideId));

    return this.findById(rideId, requesterId);
  }

  async rate(rideId: string, requesterId: string, dto: RateRideDto) {
    const ride = await this.findById(rideId, requesterId);
    if (ride.status !== 'COMPLETED') {
      throw new ForbiddenException('Can only rate a completed ride');
    }

    const isRiderRating = ride.riderId === requesterId;
    const toUserId = isRiderRating ? ride.driverId : ride.riderId;
    if (!toUserId) {
      throw new ForbiddenException('Ride has no counterparty to rate');
    }

    await this.db.insert(rideReviews).values({
      rideId,
      fromUserId: requesterId,
      toUserId,
      rating: dto.rating,
      comment: dto.comment,
    });

    await this.db
      .update(rides)
      .set(isRiderRating ? { driverRating: dto.rating } : { riderRating: dto.rating })
      .where(eq(rides.id, rideId));

    return { rideId, rating: dto.rating };
  }

  arrive(rideId: string, driverId: string) {
    return this.transitionAsDriver(rideId, driverId, 'ACCEPTED', 'ARRIVED', {
      arrivedAt: new Date(),
    });
  }

  start(rideId: string, driverId: string) {
    return this.transitionAsDriver(rideId, driverId, 'ARRIVED', 'IN_PROGRESS', {
      startedAt: new Date(),
    });
  }

  async complete(rideId: string, driverId: string) {
    const ride = await this.transitionAsDriver(rideId, driverId, 'IN_PROGRESS', 'COMPLETED', {
      completedAt: new Date(),
    });

    // Final fare mirrors the estimate for now — a proper close-out (actual distance/duration
    // from ride_route_points, promo/toll/waiting adjustments) is Payments' invoice-generation
    // step, not this one.
    await this.db.update(rides).set({ totalFare: ride.estimatedFare }).where(eq(rides.id, rideId));

    return this.findById(rideId, driverId);
  }

  private async transitionAsDriver(
    rideId: string,
    driverId: string,
    fromStatus: RideStatus,
    toStatus: RideStatus,
    extra: Record<string, unknown>,
  ) {
    const ride = await this.db.query.rides.findFirst({ where: eq(rides.id, rideId) });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.driverId !== driverId) {
      throw new ForbiddenException('Not the assigned driver for this ride');
    }
    if (ride.status !== fromStatus) {
      throw new ForbiddenException(
        `Ride must be ${fromStatus} to move to ${toStatus} (is ${ride.status})`,
      );
    }

    await this.db
      .update(rides)
      .set({ status: toStatus, updatedAt: new Date(), ...extra })
      .where(eq(rides.id, rideId));

    return this.findById(rideId, driverId);
  }

  private async countRecentOffences(userId: string): Promise<number> {
    const since = new Date(Date.now() - CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000);
    const rows = await this.db.query.cancellationPenalties.findMany({
      where: eq(cancellationPenalties.userId, userId),
    });
    return rows.filter((row) => !row.isWaived && row.createdAt >= since).length;
  }
}
