import { isWithinHourWindow } from './pricing.service';

describe('isWithinHourWindow', () => {
  it('matches a plain same-day window (e.g. morning/evening peak)', () => {
    expect(isWithinHourWindow(8, 7, 10)).toBe(true); // 8am inside 7-10am
    expect(isWithinHourWindow(7, 7, 10)).toBe(true); // start hour is inclusive
    expect(isWithinHourWindow(10, 7, 10)).toBe(false); // end hour is exclusive
    expect(isWithinHourWindow(12, 7, 10)).toBe(false); // outside the window
  });

  it('matches a window that wraps past midnight (e.g. night surcharge)', () => {
    expect(isWithinHourWindow(23, 23, 5)).toBe(true);
    expect(isWithinHourWindow(2, 23, 5)).toBe(true);
    expect(isWithinHourWindow(5, 23, 5)).toBe(false); // end hour is exclusive
    expect(isWithinHourWindow(12, 23, 5)).toBe(false); // outside the window
  });
});
