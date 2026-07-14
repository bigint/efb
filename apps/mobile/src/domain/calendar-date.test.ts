import { describe, expect, it } from 'vitest';

import { calendarDateInTimeZone } from './calendar-date';

describe('calendar date in time zone', () => {
  it('resolves the location calendar date across a UTC boundary', () => {
    const instant = new Date('2026-07-14T20:00:00.000Z');
    expect(calendarDateInTimeZone(instant, 'Asia/Kolkata')).toBe('2026-07-15');
    expect(calendarDateInTimeZone(instant, 'America/Denver')).toBe('2026-07-14');
  });

  it('fails closed for invalid clock and time-zone inputs', () => {
    expect(calendarDateInTimeZone(new Date(Number.NaN), 'Asia/Kolkata')).toBeNull();
    expect(calendarDateInTimeZone(new Date(), 'Not/AZone')).toBeNull();
  });
});
