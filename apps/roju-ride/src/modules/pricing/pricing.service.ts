import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { fareConfigs } from '../../db/schema';

export interface FareEstimate {
  fareConfigId: string;
  estimatedFare: number;
  surgeMultiplier: number;
  minimumFare: number;
}

// The formula from docs/system-design-research.md §4.2. Surge is a flat 1.0 for now — the
// live per-H3-cell demand/supply multiplier (surge_zones_history) is a Geo-module concern
// that hasn't landed yet; wiring it in later only touches the one line below, not this
// service's callers.
@Injectable()
export class PricingService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async estimateFare(
    city: string,
    rideType: string,
    distanceKm: number,
    durationMin: number,
  ): Promise<FareEstimate> {
    const config = await this.getActiveFareConfig(city, rideType);
    const surgeMultiplier = 1.0; // TODO: read from surge_zones_history once Geo/Matching land

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
