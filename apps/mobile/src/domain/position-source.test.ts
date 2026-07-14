import { describe, expect, it } from 'vitest';

import { greatCircleDistance, position } from '@driftline/geospatial';

import {
  advanceSimulationSample,
  evaluatePosition,
  type SimulationSample,
} from './position-source';

const sample: SimulationSample = {
  altitudeFeet: 4_500,
  groundspeedKnots: 118,
  horizontalAccuracyMetres: 50,
  latitude: 12,
  longitude: 77,
  sampledAt: 10_000,
  trackTrueDegrees: null,
};

describe('position source evaluation', () => {
  it('advances a deterministic true-track simulation by elapsed time', () => {
    const origin = position(0, 0);
    const first = advanceSimulationSample({
      altitudeFeet: 4_500,
      groundspeedKnots: 120,
      horizontalAccuracyMetres: 50,
      origin,
      previous: null,
      sampledAt: 10_000,
      trackTrueDegrees: 90,
    });
    const second = advanceSimulationSample({
      altitudeFeet: 4_500,
      groundspeedKnots: 120,
      horizontalAccuracyMetres: 50,
      origin,
      previous: first,
      sampledAt: 11_000,
      trackTrueDegrees: 90,
    });
    expect(second.latitude).toBeCloseTo(0, 10);
    expect(second.longitude).toBeGreaterThan(first.longitude);
    expect(
      greatCircleDistance(
        position(first.latitude, first.longitude),
        position(second.latitude, second.longitude),
      ),
    ).toBeCloseTo(120 / 3_600, 10);
    expect(second.trackTrueDegrees).toBe(90);
  });

  it('pauses movement across long lifecycle gaps and rejects clock reversal', () => {
    const origin = position(12, 77);
    const first = advanceSimulationSample({
      altitudeFeet: 4_500,
      groundspeedKnots: 120,
      horizontalAccuracyMetres: 50,
      origin,
      previous: null,
      sampledAt: 10_000,
      trackTrueDegrees: 90,
    });
    expect(
      advanceSimulationSample({
        altitudeFeet: 4_500,
        groundspeedKnots: 120,
        horizontalAccuracyMetres: 50,
        origin,
        previous: first,
        sampledAt: 20_000,
        trackTrueDegrees: 90,
      }),
    ).toMatchObject({
      latitude: first.latitude,
      longitude: first.longitude,
      sampledAt: 20_000,
    });
    expect(() =>
      advanceSimulationSample({
        altitudeFeet: 4_500,
        groundspeedKnots: 120,
        horizontalAccuracyMetres: 50,
        origin,
        previous: first,
        sampledAt: 9_999,
        trackTrueDegrees: 90,
      }),
    ).toThrow('backwards');
  });

  it('exposes a fresh simulated sample with age and origin', () => {
    expect(evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, sample, 10_500)).toEqual(
      {
        ageMilliseconds: 500,
        kind: 'available',
        origin: 'simulated',
        sample,
      },
    );
  });

  it.each([
    [{ kind: 'disabled' }, sample, 10_500, 'no-active-source'],
    [{ gpsAvailable: false, kind: 'simulated' }, sample, 10_500, 'gps-outage'],
    [{ gpsAvailable: true, kind: 'simulated' }, null, 10_500, 'no-sample'],
    [{ gpsAvailable: true, kind: 'simulated' }, sample, 13_001, 'stale-sample'],
    [{ gpsAvailable: true, kind: 'simulated' }, sample, 9_999, 'clock-invalid'],
  ] as const)('fails closed for %s', (scenario, value, now, reason) => {
    expect(evaluatePosition(scenario, value, now)).toEqual({ kind: 'unavailable', reason });
  });

  it.each([
    [{ ...sample, sampledAt: Number.NaN }, 10_500],
    [{ ...sample, horizontalAccuracyMetres: Number.NaN }, 10_500],
    [{ ...sample, horizontalAccuracyMetres: -1 }, 10_500],
    [{ ...sample, latitude: 91 }, 10_500],
    [{ ...sample, groundspeedKnots: -1 }, 10_500],
    [{ ...sample, trackTrueDegrees: 360 }, 10_500],
  ] as const)('rejects a non-finite or out-of-domain sample %#', (value, now) => {
    expect(evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, value, now)).toEqual({
      kind: 'unavailable',
      reason: 'sample-invalid',
    });
  });

  it('rejects a non-finite evaluation clock', () => {
    expect(
      evaluatePosition({ gpsAvailable: true, kind: 'simulated' }, sample, Number.NaN),
    ).toEqual({ kind: 'unavailable', reason: 'clock-invalid' });
  });
});
