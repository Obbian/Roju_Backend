import { isHyderabadRushPickup, searchRadiiFor } from './matching.service';

// Senior's brief (2026-09-15): Hyderabad rush localities (Gachibowli, HITEC City, Kondapur,
// Madhapur, Jubilee Hills, Film Nagar) search 0-1.5km first and widen to 5km max if nothing
// is found there; the rest of Hyderabad goes straight to 0-5km; every other city keeps the
// original 3km/8km expanding search.
describe('searchRadiiFor', () => {
  it('gives rush localities the tight 1.5km-then-5km tiers', () => {
    // Gachibowli's own center — trivially inside its rush zone.
    expect(searchRadiiFor('Hyderabad', 17.4401, 78.3489)).toEqual([1500, 5000]);
    // ~1km from HITEC City's center — still inside the 3km catchment radius.
    expect(searchRadiiFor('Hyderabad', 17.4525, 78.3772)).toEqual([1500, 5000]);
  });

  it('gives the rest of Hyderabad a single 5km tier, no 1.5km attempt', () => {
    // Uppal and Secunderabad are both >3km from every listed rush locality.
    expect(searchRadiiFor('Hyderabad', 17.399, 78.559)).toEqual([5000]);
    expect(searchRadiiFor('Hyderabad', 17.4399, 78.4983)).toEqual([5000]);
  });

  it('never widens past 5km for any Hyderabad pickup, rush or not', () => {
    expect(searchRadiiFor('Hyderabad', 17.4401, 78.3489)[1]).toBe(5000);
    expect(searchRadiiFor('Hyderabad', 17.399, 78.559)[0]).toBe(5000);
  });

  it('leaves every other city on the original 3km/8km expanding search', () => {
    expect(searchRadiiFor('Mumbai', 19.076, 72.8777)).toEqual([3000, 8000]);
    expect(searchRadiiFor('Bengaluru', 12.9716, 77.5946)).toEqual([3000, 8000]);
  });

  it('treats the city match as case-sensitive — a differently-cased value falls through to the default', () => {
    // Guards a real gap: rideCategoryCities.city is a free-text column with no enum/case
    // constraint, so a mismatched case here silently loses the Hyderabad-specific rule
    // instead of erroring — this test documents that behavior rather than hiding it.
    expect(searchRadiiFor('hyderabad', 17.4401, 78.3489)).toEqual([3000, 8000]);
  });
});

describe('isHyderabadRushPickup', () => {
  it('is true exactly at a rush locality center', () => {
    expect(isHyderabadRushPickup(17.4401, 78.3489)).toBe(true);
  });

  it('is true just inside the 3km catchment radius', () => {
    // ~2.5km north of Gachibowli's center.
    expect(isHyderabadRushPickup(17.4626, 78.3489)).toBe(true);
  });

  it('is false once clearly outside every rush locality\'s catchment radius', () => {
    expect(isHyderabadRushPickup(17.399, 78.559)).toBe(false);
  });
});
