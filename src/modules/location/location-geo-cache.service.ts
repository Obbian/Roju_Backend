import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

export interface NearbyDriver {
  driverId: string;
  distanceMeters: number;
}

// Live "who's online and where, right now" cache — one Redis GEO set per drivers.vehicleType
// (the exact ride_categories.code a driver is registered under, e.g. AUTO/AUTO_LITE/CABX).
// Redis's native GEO commands (geohash-backed) stand in for Uber's S2-cell index here — same
// job (radius search without scanning the whole city), no custom cell-bucketing code needed.
// This is a distinct concern from the H3-cell buckets on surge_zones_history, which aggregate
// demand/supply per tick rather than answering "who's nearby right now."
@Injectable()
export class LocationGeoCacheService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(vehicleType: string): string {
    return `geo:drivers:${vehicleType}`;
  }

  async upsert(vehicleType: string, driverId: string, lon: number, lat: number): Promise<void> {
    await this.redis.geoadd(this.key(vehicleType), lon, lat, driverId);
  }

  async remove(vehicleType: string, driverId: string): Promise<void> {
    await this.redis.zrem(this.key(vehicleType), driverId);
  }

  async searchNearby(
    vehicleType: string,
    lon: number,
    lat: number,
    radiusMeters: number,
  ): Promise<NearbyDriver[]> {
    const results = (await this.redis.geosearch(
      this.key(vehicleType),
      'FROMLONLAT',
      lon,
      lat,
      'BYRADIUS',
      radiusMeters,
      'm',
      'ASC',
      'WITHDIST',
    )) as unknown as Array<[string, string]>;

    return results.map(([driverId, distance]) => ({
      driverId,
      distanceMeters: Number(distance),
    }));
  }
}
