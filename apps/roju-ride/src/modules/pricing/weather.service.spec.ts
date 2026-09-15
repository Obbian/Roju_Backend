import { weatherMultiplierFor } from './weather.service';

describe('weatherMultiplierFor', () => {
  it('applies a surge multiplier for adverse conditions', () => {
    expect(weatherMultiplierFor('Rain')).toBe(1.3);
    expect(weatherMultiplierFor('Thunderstorm')).toBe(1.5);
    expect(weatherMultiplierFor('Snow')).toBe(1.3);
  });

  it('applies no surge for clear/normal conditions', () => {
    expect(weatherMultiplierFor('Clear')).toBe(1);
    expect(weatherMultiplierFor('Clouds')).toBe(1);
  });

  it('defaults to no surge for an unmapped or missing condition', () => {
    expect(weatherMultiplierFor('SomethingNew')).toBe(1);
    expect(weatherMultiplierFor(undefined)).toBe(1);
  });
});
