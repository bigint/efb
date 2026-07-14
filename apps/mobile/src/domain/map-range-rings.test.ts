import { describe, expect, it } from 'vitest';

import { greatCircleDistance, position } from '@driftline/geospatial';

import { buildMapRangeRings } from './map-range-rings';

describe('map range rings', () => {
  it('builds a closed spherical ring at the requested radius', () => {
    const center = position(0, 0);
    const result = buildMapRangeRings(center, [60], 36);
    expect(result.features).toHaveLength(1);
    const lines = result.features[0]?.geometry.coordinates;
    expect(lines).toHaveLength(1);
    expect(lines?.[0]).toHaveLength(37);
    expect(lines?.[0]?.[0]).toEqual(lines?.[0]?.at(-1));
    for (const coordinate of lines?.[0] ?? []) {
      expect(greatCircleDistance(center, position(coordinate[1], coordinate[0]))).toBeCloseTo(
        60,
        8,
      );
    }
  });

  it('splits dateline crossings without drawing a world-spanning segment', () => {
    const result = buildMapRangeRings(position(0, 179.8), [60], 72);
    const lines = result.features[0]?.geometry.coordinates ?? [];
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        expect(
          Math.abs((line[index]?.[0] ?? 0) - (line[index - 1]?.[0] ?? 0)),
        ).toBeLessThanOrEqual(180);
      }
    }
  });

  it('rejects unbounded display geometry requests', () => {
    expect(() => buildMapRangeRings(position(0, 0), [], 72)).toThrow(RangeError);
    expect(() => buildMapRangeRings(position(0, 0), [5], 11)).toThrow(RangeError);
    expect(() => buildMapRangeRings(position(0, 0), [501], 72)).toThrow(RangeError);
  });
});
