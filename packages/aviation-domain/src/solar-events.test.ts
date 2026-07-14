import { describe, expect, it } from 'vitest';

import { position } from '@driftline/geospatial';

import { calculateSolarEvents } from './solar-events';

describe('NOAA-derived solar events', () => {
  it('computes UTC instants for a bounded local calendar date', () => {
    expect(calculateSolarEvents(position(12.9716, 77.5946), '2026-07-14')).toEqual({
      accuracy: 'noaa-theoretical-one-minute',
      kind: 'available',
      localCalendarDate: '2026-07-14',
      sunriseUtc: '2026-07-14T00:31:00.000Z',
      sunsetUtc: '2026-07-14T13:20:00.000Z',
    });
    expect(calculateSolarEvents(position(40.7128, -74.006), '2026-07-14')).toMatchObject({
      kind: 'available',
      sunriseUtc: '2026-07-14T09:37:00.000Z',
      sunsetUtc: '2026-07-15T00:26:00.000Z',
    });
  });

  it('reports polar day and night instead of inventing event times', () => {
    expect(calculateSolarEvents(position(78.2232, 15.6469), '2026-06-21')).toEqual({
      kind: 'unavailable',
      reason: 'polar-day',
    });
    expect(calculateSolarEvents(position(78.2232, 15.6469), '2026-12-21')).toEqual({
      kind: 'unavailable',
      reason: 'polar-night',
    });
  });

  it('fails closed outside the supported exact date range', () => {
    expect(calculateSolarEvents(position(0, 0), '2026-02-30')).toEqual({
      kind: 'unavailable',
      reason: 'invalid-date',
    });
    expect(calculateSolarEvents(position(0, 0), '2100-01-01')).toEqual({
      kind: 'unavailable',
      reason: 'invalid-date',
    });
  });
});
