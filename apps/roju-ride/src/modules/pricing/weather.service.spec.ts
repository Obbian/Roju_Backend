import { weatherMultiplierFor } from './weather.service';

describe('weatherMultiplierFor', () => {
  it('applies a surge multiplier for adverse conditions', () => {
    expect(weatherMultiplierFor(4001)).toBe(1.3); // Rain
    expect(weatherMultiplierFor(8000)).toBe(1.5); // Thunderstorm
    expect(weatherMultiplierFor(5000)).toBe(1.3); // Snow
  });

  it('applies no surge for clear/cloudy conditions', () => {
    expect(weatherMultiplierFor(1000)).toBe(1); // Clear, Sunny
    expect(weatherMultiplierFor(1001)).toBe(1); // Cloudy
  });

  it('defaults to no surge for an unmapped or missing weather code', () => {
    expect(weatherMultiplierFor(9999)).toBe(1);
    expect(weatherMultiplierFor(undefined)).toBe(1);
  });
});
