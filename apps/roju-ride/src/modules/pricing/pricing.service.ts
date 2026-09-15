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
// concern that hasn't landed yet — but weather surge (WeatherService) is live and multiplies
// in alongside it, so wiring in the demand component later only touches the one line below.
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
    const surgeMultiplier = demandSurgeMultiplier * weatherMultiplier;

    const hour = new Date().getHours();
    const isNight = this.isWithinNightWindow(hour, config.nightStartHour, config.nightEndHour);

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

  private isWithinNightWindow(hour: number, nightStartHour: number, nightEndHour: number): boolean {
    if (nightStartHour <= nightEndHour) {
      return hour >= nightStartHour && hour < nightEndHour;
    }
    // window wraps past midnight, e.g. 23 -> 5
    return hour >= nightStartHour || hour < nightEndHour;
  }
}
