import { describe, expect, it } from 'vitest';

import { appendPositionTrail, buildPositionTrailGeometry } from './position-trail';
import type { PositionSample } from './position-source';

const sample = (sampledAt: number, latitude: number, longitude: number): PositionSample => ({
  altitudeFeet: null,
  groundspeedKnots: null,
  horizontalAccuracyMetres: null,
  latitude,
  longitude,
  sampledAt,
  trackDegrees: null,
  trackReference: 'true',
});

describe('session position trail', () => {
  it('appends movement, ignores stationary updates, and enforces its bound', () => {
    let trail = appendPositionTrail([], 'simulated', sample(1, 0, 0), 2);
    trail = appendPositionTrail(trail, 'simulated', sample(2, 0, 0), 2);
    expect(trail).toHaveLength(1);
    expect(trail[0]?.sampledAt).toBe(2);
    trail = appendPositionTrail(trail, 'simulated', sample(3, 0, 1), 2);
    trail = appendPositionTrail(trail, 'simulated', sample(4, 0, 2), 2);
    expect(trail.map(({ longitude }) => longitude)).toEqual([1, 2]);
  });

  it('resets on source changes, clock rollback, and replacement samples', () => {
    const initial = appendPositionTrail([], 'simulated', sample(10, 0, 0));
    expect(appendPositionTrail(initial, 'device', sample(11, 0, 1))).toHaveLength(1);
    expect(appendPositionTrail(initial, 'simulated', sample(9, 0, 1))).toHaveLength(1);
    expect(appendPositionTrail(initial, 'simulated', sample(10, 0, 1))).toHaveLength(1);
  });

  it('splits an antimeridian crossing into bounded line segments', () => {
    let trail = appendPositionTrail([], 'device', sample(1, 10, 179.8));
    trail = appendPositionTrail(trail, 'device', sample(2, 10.1, -179.8));
    const geometry = buildPositionTrailGeometry(trail);
    expect(geometry.coordinates).toHaveLength(2);
    for (const line of geometry.coordinates) {
      for (let index = 1; index < line.length; index += 1) {
        expect(
          Math.abs((line[index]?.[0] ?? 0) - (line[index - 1]?.[0] ?? 0)),
        ).toBeLessThanOrEqual(180);
      }
    }
  });

  it('rejects malformed coordinates and unsupported limits', () => {
    expect(() => appendPositionTrail([], 'device', sample(1, 91, 0))).toThrow(RangeError);
    expect(() => appendPositionTrail([], 'device', sample(1, 0, 0), 1)).toThrow(RangeError);
  });
});
