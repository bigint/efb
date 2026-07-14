import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { nauticalMiles, trueDegrees } from '@driftline/data-contracts';

import { destinationPoint, greatCircleDistance, initialTrueBearing } from './great-circle';
import { position } from './position';

const coordinate = fc.tuple(
  fc.double({ min: -89.999, max: 89.999, noNaN: true }),
  fc.double({ min: -180, max: 180, noNaN: true }),
);
const nonPolarCoordinate = fc.tuple(
  fc.double({ min: -85, max: 85, noNaN: true }),
  fc.double({ min: -180, max: 180, noNaN: true }),
);

describe('great-circle properties', () => {
  it('is symmetric and non-negative across finite global coordinates', () => {
    fc.assert(
      fc.property(coordinate, coordinate, ([latA, lonA], [latB, lonB]) => {
        const a = position(latA, lonA);
        const b = position(latB, lonB);
        const forward = greatCircleDistance(a, b);
        const reverse = greatCircleDistance(b, a);
        expect(forward).toBeGreaterThanOrEqual(0);
        expect(forward).toBeLessThanOrEqual(10_810.1);
        expect(reverse).toBeCloseTo(forward, 9);
      }),
      { numRuns: 500 },
    );
  });

  it('round trips destination distance and bearing away from polar singularities', () => {
    fc.assert(
      fc.property(
        nonPolarCoordinate,
        fc.double({ min: 0, max: 359.999, noNaN: true }),
        fc.double({ min: 0.01, max: 5_000, noNaN: true }),
        ([latitude, longitude], bearing, distance) => {
          const start = position(latitude, longitude);
          const end = destinationPoint(start, trueDegrees(bearing), nauticalMiles(distance));
          expect(Math.abs(greatCircleDistance(start, end) - distance)).toBeLessThan(1e-6);
          const calculatedBearing = initialTrueBearing(start, end);
          const bearingError = Math.abs(((calculatedBearing - bearing + 540) % 360) - 180);
          expect(bearingError).toBeLessThan(1e-6);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('uses the short path across the antimeridian', () => {
    const distance = greatCircleDistance(position(10, 179.9), position(10, -179.9));
    expect(distance).toBeGreaterThan(11);
    expect(distance).toBeLessThan(12);
  });
});
