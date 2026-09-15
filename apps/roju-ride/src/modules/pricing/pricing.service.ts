import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { fareConfigs } from '../../db/schema';
import { WeatherService } from './weather.service';

export interface FareEstimate {
  fareConfigId: string;
  estimatedFare: number;
  surgeMultiplier: number;
  minimumFare: number;
}

// The formula from docs/system-design-research.md §4.2. Demand-based surge is still a flat
// 1.0 — the live per-H3-cell demand/supply multiplier (surge_zones_history) is a Geo/Matching
// concern that hasn't landed yet, and unlike Uber's real-time demand-forecasting engine (too
// heavy for this stage — see 2026-09-15 research), peak-hour surge here is a fixed
// morning/evening window + flat multiplier, same mechanism as the existing night surcharge.
// Both weather surge and peak surge are live and multiply in alongside it, so wiring in the
// demand component later only touches the one line below.
@Injectable()
export class PricingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly weatherService: WeatherService,
  ) {}

  async estimateFare(
    city: string,
    rideType: string,
    distanceKm: number,
    durationMin: number,
    pickupLat?: number,
    pickupLon?: number,
  ): Promise<FareEstimate> {
    const config = await this.getActiveFareConfig(city, rideType);
    const demandSurgeMultiplier = 1.0; // TODO: read from surge_zones_history once Geo/Matching land
    const weatherMultiplier =
      pickupLat !== undefined && pickupLon !== undefined
        ? await this.weatherService.getSurgeMultiplier(pickupLat, pickupLon)
        : 1;

    const hour = new Date().getHours();
    const isPeak =
      isWithinHourWindow(hour, config.peakMorningStartHour, config.peakMorningEndHour) ||
      isWithinHourWindow(hour, config.peakEveningStartHour, config.peakEveningEndHour);
    const peakMultiplier = isPeak ? Number(config.peakSurgeMultiplier) : 1;

    const surgeMultiplier = demandSurgeMultiplier * weatherMultiplier * peakMultiplier;

    const isNight = isWithinHourWindow(hour, config.nightStartHour, config.nightEndHour);

    let fare =
      Number(config.baseFare) +
      Number(config.perKmRate) * distanceKm +
      Number(config.perMinuteRate) * durationMin +
      (isNight ? Number(config.nightSurchargeFare) : 0);

    fare = Math.max(fare, Number(config.minimumFare));
    fare = fare * surgeMultiplier;

    return {
      fareConfigId: config.id,
      estimatedFare: Math.round(fare * 100) / 100,
      surgeMultiplier,
      minimumFare: Number(config.minimumFare),
    };
  }

  async getActiveFareConfig(city: string, rideType: string) {
    const [config] = await this.db
      .select()
      .from(fareConfigs)
      .where(
        and(
          eq(fareConfigs.city, city),
          eq(fareConfigs.rideType, rideType),
          eq(fareConfigs.isActive, true),
        ),
      );

    if (!config) {
      throw new NotFoundException(`No active fare config for ${rideType} in ${city}`);
    }

    return config;
  }
}

// Exported for pricing.service.spec.ts — pure, no DB/HTTP wiring needed to test it.
export function isWithinHourWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  }
  // window wraps past midnight, e.g. 23 -> 5
  return hour >= startHour || hour < endHour;
}
