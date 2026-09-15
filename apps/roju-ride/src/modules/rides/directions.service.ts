import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
}

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// Stands in until self-hosted OSRM is live (HLD §5, §9) — a paid per-call maps API doesn't
// hold up at the client's stated ride volume, so this is deliberately the interim, not the
// long-term answer. Also the fallback when GOOGLE_MAPS_API_KEY is unset or the call fails.
const PLACEHOLDER_AVG_SPEED_KMPH = 25;

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

interface DirectionsResponse {
  status: string;
  routes: Array<{ legs: Array<{ distance: { value: number }; duration: { value: number } }> }>;
}

@Injectable()
export class DirectionsService {
  private readonly logger = new Logger(DirectionsService.name);

  constructor(private readonly config: ConfigService) {}

  async estimateRoute(
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number,
  ): Promise<RouteEstimate> {
    const apiKey = this.config.get<string>('maps.googleMapsApiKey');
    if (!apiKey) {
      return this.straightLineFallback(pickupLat, pickupLon, dropoffLat, dropoffLon);
    }

    const url = new URL(DIRECTIONS_URL);
    url.searchParams.set('origin', `${pickupLat},${pickupLon}`);
    url.searchParams.set('destination', `${dropoffLat},${dropoffLon}`);
    url.searchParams.set('key', apiKey);

    try {
      const response = await fetch(url);
      const body = (await response.json()) as DirectionsResponse;
      const leg = body.routes?.[0]?.legs?.[0];
      if (body.status !== 'OK' || !leg) {
        throw new Error(body.status ?? 'No route returned');
      }

      const distanceKm = leg.distance.value / 1000;
      const durationMin = Math.round(leg.duration.value / 60);
      this.logger.log(
        `Google Directions route: ${distanceKm.toFixed(2)}km / ${durationMin}min`,
      );
      return { distanceKm, durationMin };
    } catch (err) {
      // A routing-provider outage degrades ETA accuracy, it never blocks booking (HLD §12).
      this.logger.warn(
        `Google Directions lookup failed, falling back to straight-line estimate: ${(err as Error).message}`,
      );
      return this.straightLineFallback(pickupLat, pickupLon, dropoffLat, dropoffLon);
    }
  }

  private straightLineFallback(
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number,
  ): RouteEstimate {
    const distanceKm = haversineKm(pickupLat, pickupLon, dropoffLat, dropoffLon);
    const durationMin = Math.round((distanceKm / PLACEHOLDER_AVG_SPEED_KMPH) * 60);
    return { distanceKm, durationMin };
  }
}
