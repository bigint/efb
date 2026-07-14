import { describe, expect, it } from 'vitest';

import { knots } from '@driftline/data-contracts';
import { position } from '@driftline/geospatial';

import { calculateRoute } from './route';

describe('route calculation', () => {
  const route = [
    { identifier: 'A', position: position(0, 0) },
    { identifier: 'B', position: position(0, 1) },
    { identifier: 'C', position: position(1, 1) },
  ] as const;

  it('calculates deterministic legs, course, distance and time', () => {
    const result = calculateRoute(route, knots(120));
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]?.initialTrueCourse).toBeCloseTo(90, 10);
    expect(result.totalDistance).toBeCloseTo(120.08, 1);
    expect(result.estimatedMinutes).toBeCloseTo(60.04, 1);
  });

  it('does not invent time without groundspeed', () => {
    expect(calculateRoute(route, null).estimatedMinutes).toBeNull();
  });

  it('rejects ambiguous and unsafe inputs', () => {
    expect(() => calculateRoute(route, knots(0))).toThrow(RangeError);
    expect(() => calculateRoute([route[0], route[0]], knots(100))).toThrow(RangeError);
  });
});
