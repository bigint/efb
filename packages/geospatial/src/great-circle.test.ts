import { describe, expect, it } from 'vitest';

import { nauticalMiles, trueDegrees } from '@driftline/data-contracts';

import {
  destinationPoint,
  greatCircleDistance,
  initialTrueBearing,
  trackOffset,
} from './great-circle';
import { position } from './position';

describe('spherical great-circle calculations', () => {
  it('measures one equatorial degree independently from the formula under test', () => {
    const expected = (Math.PI * 6_371_008.8) / 180 / 1852;
    expect(greatCircleDistance(position(0, 0), position(0, 1))).toBeCloseTo(expected, 10);
  });

  it('calculates cardinal initial bearings', () => {
    expect(initialTrueBearing(position(0, 0), position(0, 10))).toBeCloseTo(90, 10);
    expect(initialTrueBearing(position(0, 0), position(10, 0))).toBeCloseTo(0, 10);
  });

  it('round trips a destination point', () => {
    const start = position(12.9716, 77.5946);
    const destination = destinationPoint(start, trueDegrees(42), nauticalMiles(125));
    expect(greatCircleDistance(start, destination)).toBeCloseTo(125, 9);
    expect(initialTrueBearing(start, destination)).toBeCloseTo(42, 9);
  });

  it('reports signed cross-track and along-track distance', () => {
    const offset = trackOffset(position(0, 0), position(0, 10), position(-1, 5));
    expect(offset.crossTrack).toBeGreaterThan(60);
    expect(offset.crossTrack).toBeLessThan(61);
    expect(offset.alongTrack).toBeCloseTo(300.2, 0);
  });

  it('fails closed for undefined bearings and tracks', () => {
    expect(() => initialTrueBearing(position(1, 2), position(1, 2))).toThrow(RangeError);
    expect(() => initialTrueBearing(position(0, 0), position(0, 180))).toThrow('antipodal');
    expect(() => trackOffset(position(1, 2), position(1, 2), position(2, 3))).toThrow(
      RangeError,
    );
  });
});
