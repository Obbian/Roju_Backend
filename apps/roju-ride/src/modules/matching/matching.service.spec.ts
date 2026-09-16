import { isRushPickup, radiiForCity } from './matching.service';

// Mirrors the rows seeded into rush_areas for Hyderabad (see migrations/0003_*.sql) — kept
// here as fixtures so these tests stay pure/DB-free, not because the app hardcodes this list.
const HYDERABAD_RUSH_AREAS = [
  { lat: 17.4401, lon: 78.3489, catchmentRadiusMeters: 3000 }, // Gachibowli
  { lat: 17.4435, lon: 78.3772, catchmentRadiusMeters: 3000 }, // HITEC City
];

// Senior's brief (2026-09-15, updated 2026-09-16): rush localities search 0-1.5km first and
// widen to 5km max if nothing is found there; the rest of a city with rush areas goes
// straight to 0-5km; every other city keeps the original 3km/8km expanding search. The area
// list itself now lives in the rush_areas table (not hardcoded) — see searchRadiiFor() in
// matching.service.ts for the DB-reading wrapper around the pure functions tested here.
describe('isRushPickup', () => {
  it('is true exactly at a rush area center', () => {
    expect(isRushPickup(17.4401, 78.3489, HYDERABAD_RUSH_AREAS)).toBe(true);
  });

  it('is true just inside a rush area\'s catchment radius', () => {
    // ~2.5km north of Gachibowli's center.
    expect(isRushPickup(17.4626, 78.3489, HYDERABAD_RUSH_AREAS)).toBe(true);
  });

  it('is false once clearly outside every rush area\'s catchment radius', () => {
    expect(isRushPickup(17.399, 78.559, HYDERABAD_RUSH_AREAS)).toBe(false);
  });

  it('is false when there are no rush areas configured at all (e.g. a new city)', () => {
    expect(isRushPickup(17.4401, 78.3489, [])).toBe(false);
  });

  it('respects each area\'s own catchment radius rather than a single global one', () => {
    const tightArea = [{ lat: 17.4401, lon: 78.3489, catchmentRadiusMeters: 500 }];
    // ~2.5km away — inside the old 3km default, but outside this area's own 500m radius.
    expect(isRushPickup(17.4626, 78.3489, tightArea)).toBe(false);
  });
});

describe('radiiForCity', () => {
  it('gives rush pickups the tight 1.5km-then-5km tiers, Hyderabad only', () => {
    expect(radiiForCity('Hyderabad', true)).toEqual([1500, 5000]);
  });

  it('gives non-rush Hyderabad pickups a single 5km tier, no 1.5km attempt', () => {
    expect(radiiForCity('Hyderabad', false)).toEqual([5000]);
  });

  it('never widens past 5km for any Hyderabad pickup, rush or not', () => {
    expect(radiiForCity('Hyderabad', true)[1]).toBe(5000);
    expect(radiiForCity('Hyderabad', false)[0]).toBe(5000);
  });

  it('leaves every other city on the original 3km/8km expanding search regardless of isRush', () => {
    expect(radiiForCity('Mumbai', true)).toEqual([3000, 8000]);
    expect(radiiForCity('Mumbai', false)).toEqual([3000, 8000]);
    expect(radiiForCity('Bengaluru', false)).toEqual([3000, 8000]);
  });

  it('treats the city match as case-sensitive — a differently-cased value falls through to the default', () => {
    // Guards a real gap: rideCategoryCities.city is a free-text column with no enum/case
    // constraint, so a mismatched case here silently loses the Hyderabad-specific rule
    // instead of erroring — this test documents that behavior rather than hiding it.
    expect(radiiForCity('hyderabad', true)).toEqual([3000, 8000]);
  });
});
