import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Placeholder multipliers, pending the actual numbers from the pricing brief — same "draft
// until confirmed" status as CANCELLATION_PENALTY_TIERS_PAISE in rides.service.ts. Keyed by
// OpenWeatherMap's top-level "main" condition group (openweathermap.org/weather-conditions).
const WEATHER_MULTIPLIERS: Record<string, number> = {
  Thunderstorm: 1.5,
  Squall: 1.4,
  Tornado: 1.5,
  Rain: 1.3,
  Snow: 1.3,
  Drizzle: 1.15,
  Ash: 1.2,
  Fog: 1.1,
  Mist: 1.1,
  Haze: 1.1,
  Dust: 1.1,
  Sand: 1.1,
};
const DEFAULT_MULTIPLIER = 1;

interface OpenWeatherResponse {
  weather?: Array<{ main: string }>;
}

// Exported for weather.service.spec.ts — pure, no HTTP/config wiring needed to test it.
export function weatherMultiplierFor(condition: string | undefined): number {
  if (!condition) return DEFAULT_MULTIPLIER;
  return WEATHER_MULTIPLIERS[condition] ?? DEFAULT_MULTIPLIER;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(private readonly config: ConfigService) {}

  // Never throws and never blocks booking — an OpenWeatherMap outage (or no key configured
  // yet) just means no weather surge gets applied, same principle as DirectionsService's
  // straight-line fallback when Google Maps is unavailable.
  async getSurgeMultiplier(lat: number, lon: number): Promise<number> {
    const apiKey = this.config.get<string>('weather.openWeatherMapApiKey');
    if (!apiKey) return DEFAULT_MULTIPLIER;

    const url = new URL(WEATHER_URL);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
    url.searchParams.set('appid', apiKey);

    try {
      const response = await fetch(url);
      const body = (await response.json()) as OpenWeatherResponse;
      const condition = body.weather?.[0]?.main;
      const multiplier = weatherMultiplierFor(condition);

      if (multiplier !== DEFAULT_MULTIPLIER) {
        this.logger.log(`Weather surge applied: ${condition} -> x${multiplier}`);
      }
      return multiplier;
    } catch (err) {
      this.logger.warn(
        `OpenWeatherMap lookup failed, no weather surge applied: ${(err as Error).message}`,
      );
      return DEFAULT_MULTIPLIER;
    }
  }
}
