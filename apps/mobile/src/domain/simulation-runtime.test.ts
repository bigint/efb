import { describe, expect, it } from 'vitest';

import { position } from '@driftline/geospatial';

import { type PositionSample } from './position-source';
import { defaultSimulationProfile } from './simulation-profile';
import { reduceSimulationTick } from './simulation-runtime';

const sample: PositionSample = {
  altitudeFeet: 4_500,
  groundspeedKnots: 118,
  horizontalAccuracyMetres: 50,
  latitude: 12,
  longitude: 77,
  sampledAt: 10_000,
  trackDegrees: 68,
  trackReference: 'true',
};
const origins = [{ identifier: 'DVL1', position: position(12, 77) }];

describe('simulation runtime tick', () => {
  it('never lets the simulator timer clear an active device sample', () => {
    expect(
      reduceSimulationTick({
        origins,
        paused: false,
        positionSample: sample,
        positionScenario: { kind: 'device', status: 'watching' },
        profile: defaultSimulationProfile,
        sampledAt: 11_000,
      }),
    ).toEqual({
      positionSample: sample,
      positionScenario: { kind: 'device', status: 'watching' },
    });
  });

  it('holds established position and altitude while refreshing paused sample time', () => {
    expect(
      reduceSimulationTick({
        origins,
        paused: true,
        positionSample: sample,
        positionScenario: { gpsAvailable: true, kind: 'simulated' },
        profile: defaultSimulationProfile,
        sampledAt: 11_000,
      }).positionSample,
    ).toEqual({ ...sample, sampledAt: 11_000 });
  });

  it('establishes the configured origin before a pre-start pause can hold it', () => {
    const result = reduceSimulationTick({
      origins,
      paused: true,
      positionSample: null,
      positionScenario: { gpsAvailable: true, kind: 'simulated' },
      profile: defaultSimulationProfile,
      sampledAt: 11_000,
    });
    expect(result.positionSample).toMatchObject({ latitude: 12, longitude: 77 });
  });

  it('fails closed on invalid clocks or unavailable configured origins', () => {
    for (const input of [
      { origins, sampledAt: Number.NaN },
      { origins: [], sampledAt: 11_000 },
    ]) {
      expect(
        reduceSimulationTick({
          ...input,
          paused: false,
          positionSample: sample,
          positionScenario: { gpsAvailable: true, kind: 'simulated' },
          profile: defaultSimulationProfile,
        }),
      ).toEqual({
        positionSample: null,
        positionScenario: { gpsAvailable: false, kind: 'simulated' },
      });
    }
  });
});
