import { describe, expect, it } from 'vitest';

import {
  appendMapMeasurementPoint,
  calculateMapMeasurement,
  type MapMeasurementPoints,
} from './map-measurement';

describe('transient map measurement', () => {
  it('builds a two-point great-circle measurement then starts a new one', () => {
    let points: MapMeasurementPoints = [];
    points = appendMapMeasurementPoint(points, 0, 0);
    points = appendMapMeasurementPoint(points, 1, 0);
    const measurement = calculateMapMeasurement(points);
    expect(measurement).toMatchObject({
      initialTrueBearing: 90,
      kind: 'ready',
    });
    if (measurement.kind !== 'ready') throw new Error('Expected complete measurement');
    expect(measurement.nauticalMiles).toBeCloseTo(60, 0);
    expect(appendMapMeasurementPoint(points, 2, 1)).toHaveLength(1);
  });

  it('keeps bearing unavailable for coincident points and rejects bad coordinates', () => {
    const first = appendMapMeasurementPoint([], 77, 12);
    const both = appendMapMeasurementPoint(first, 77, 12);
    expect(calculateMapMeasurement(both)).toEqual({
      initialTrueBearing: null,
      kind: 'ready',
      nauticalMiles: 0,
    });
    expect(() => appendMapMeasurementPoint([], 181, 12)).toThrow();
  });
});
