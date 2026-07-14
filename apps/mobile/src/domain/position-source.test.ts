import { describe, expect, it } from 'vitest';

import { evaluatePosition, type SimulationSample } from './position-source';

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
});
