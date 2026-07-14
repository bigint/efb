import { describe, expect, it } from 'vitest';

import { knots } from '@driftline/data-contracts';
import { position } from '@driftline/geospatial';

import { calculateRoute, resolveRouteIdentifiers } from './route';

describe('route calculation', () => {
  const route = [
    { identifier: 'A', position: position(0, 0) },
    { identifier: 'B', position: position(0, 1) },
    { identifier: 'C', position: position(1, 1) },
  ] as const;

  it('calculates deterministic legs, course, distance and time', () => {
    const result = calculateRoute(route, knots(120));
    expect(result.status).toBe('ready');
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]?.initialTrueCourse).toBeCloseTo(90, 10);
    expect(result.totalDistance).toBeCloseTo(120.08, 1);
    expect(result.estimatedMinutes).toBeCloseTo(60.04, 1);
  });

  it('does not invent time without groundspeed', () => {
    expect(calculateRoute(route, null).estimatedMinutes).toBeNull();
  });

  it('marks empty and one-waypoint plans incomplete without invented totals', () => {
    expect(calculateRoute([], knots(100))).toEqual({
      estimatedMinutes: null,
      legs: [],
      status: 'empty',
      totalDistance: null,
    });
    expect(calculateRoute([route[0]], knots(100))).toEqual({
      estimatedMinutes: null,
      legs: [],
      status: 'incomplete',
      totalDistance: null,
    });
  });

  it('rejects ambiguous and unsafe inputs', () => {
    expect(() => calculateRoute(route, knots(0))).toThrow(RangeError);
    expect(() => calculateRoute(route, Number.NaN as never)).toThrow(RangeError);
    expect(() => calculateRoute([route[0], route[0]], knots(100))).toThrow(RangeError);
    expect(() =>
      calculateRoute(
        Array.from({ length: 101 }, (_, index) => ({
          identifier: `W${index}`,
          position: position(0, index / 1_000),
        })),
        knots(100),
      ),
    ).toThrow('limit');
    expect(() => resolveRouteIdentifiers(['A'], [route[0], { ...route[0] }])).toThrow(
      'ambiguous',
    );
    expect(() => resolveRouteIdentifiers(['bad input'], route)).toThrow('identifier');
    expect(() =>
      calculateRoute(
        [route[0], { ...route[1], position: { latitude: 91, longitude: 0 } as never }],
        knots(100),
      ),
    ).toThrow('position');
    expect(() =>
      resolveRouteIdentifiers(
        ['A'],
        Array.from({ length: 10_001 }, (_, index) => ({
          identifier: `W${index}`,
          position: position(0, 0),
        })),
      ),
    ).toThrow('collection');
  });

  it('preserves unresolved route intent instead of silently shortening it', () => {
    expect(resolveRouteIdentifiers(['A', 'MISSING', 'C'], route)).toEqual({
      status: 'unresolved',
      unresolvedIdentifiers: ['MISSING'],
    });
  });
});
