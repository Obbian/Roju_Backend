import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const WEATHER_URL = 'https://api.tomorrow.io/v4/weather/realtime';

// Placeholder multipliers, pending the actual numbers from the pricing brief — same "draft
// until confirmed" status as CANCELLATION_PENALTY_TIERS_PAISE in rides.service.ts. Keyed by
// Tomorrow.io's numeric weatherCode (docs.tomorrow.io/reference/data-layers-weather-codes) —
// chosen over Uber for this exact "is it raining right now" signal (2026-09-15 research).
const WEATHER_MULTIPLIERS: Record<number, number> = {
  4000: 1.15, // Drizzle
  4200: 1.2, // Light Rain
  4001: 1.3, // Rain
  4201: 1.5, // Heavy Rain
  5000: 1.3, // Snow
  5001: 1.15, // Flurries
  5100: 1.2, // Light Snow
  5101: 1.5, // Heavy Snow
  6000: 1.3, // Freezing Drizzle
  6001: 1.4, // Freezing Rain
  6200: 1.3, // Light Freezing Rain
  6201: 1.6, // Heavy Freezing Rain
  7000: 1.4, // Ice Pellets
  7101: 1.6, // Heavy Ice Pellets
  7102: 1.2, // Light Ice Pellets
  8000: 1.5, // Thunderstorm
  2000: 1.1, // Fog
  2100: 1.05, // Light Fog
};
const DEFAULT_MULTIPLIER = 1;

interface TomorrowIoResponse {
  data?: { values?: { weatherCode?: number } };
}

// Exported for weather.service.spec.ts — pure, no HTTP/config wiring needed to test it.
export function weatherMultiplierFor(weatherCode: number | undefined): number {
  if (weatherCode === undefined) return DEFAULT_MULTIPLIER;
  return WEATHER_MULTIPLIERS[weatherCode] ?? DEFAULT_MULTIPLIER;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(private readonly config: ConfigService) {}

  // Never throws and never blocks booking — a Tomorrow.io outage (or no key configured yet)
  // just means no weather surge gets applied, same principle as DirectionsService's
  // straight-line fallback when Google Maps is unavailable.
  async getSurgeMultiplier(lat: number, lon: number): Promise<number> {
    const apiKey = this.config.get<string>('weather.tomorrowIoApiKey');
    if (!apiKey) return DEFAULT_MULTIPLIER;

    const url = new URL(WEATHER_URL);
    url.searchParams.set('location', `${lat},${lon}`);
    url.searchParams.set('apikey', apiKey);

    try {
      const response = await fetch(url);
      const body = (await response.json()) as TomorrowIoResponse;
      const weatherCode = body.data?.values?.weatherCode;
      const multiplier = weatherMultiplierFor(weatherCode);

      if (multiplier !== DEFAULT_MULTIPLIER) {
        this.logger.log(`Weather surge applied: code ${weatherCode} -> x${multiplier}`);
      }
      return multiplier;
    } catch (err) {
      this.logger.warn(
        `Tomorrow.io lookup failed, no weather surge applied: ${(err as Error).message}`,
      );
      return DEFAULT_MULTIPLIER;
    }
  }
}
