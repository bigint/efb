import { position } from '@driftline/geospatial';
import { describe, expect, it } from 'vitest';

import { calculateRelativePosition } from './relative-position';

const available = {
  ageMilliseconds: 500,
  kind: 'available' as const,
  origin: 'simulated' as const,
  sample: {
    altitudeFeet: 4_500,
    groundspeedKnots: 118,
    horizontalAccuracyMetres: 50,
    latitude: 0,
    longitude: 0,
    sampledAt: 1_000,
    trackDegrees: 90,
    trackReference: 'true' as const,
  },
};

describe('relative position readout', () => {
  it('calculates a true bearing and distance from an available sample', () => {
    expect(calculateRelativePosition(available, position(0, 1))).toMatchObject({
      accuracyMetres: 50,
      ageMilliseconds: 500,
      bearingTrue: 90,
      origin: 'simulated',
    });
    expect(
      calculateRelativePosition(available, position(0, 1))?.distanceNauticalMiles,
    ).toBeCloseTo(60.04, 1);
  });

  it('returns no readout for unavailable position and no bearing at zero distance', () => {
    expect(
      calculateRelativePosition(
        { kind: 'unavailable', reason: 'stale-sample' },
        position(0, 1),
      ),
    ).toBeNull();
    expect(calculateRelativePosition(available, position(0, 0))).toMatchObject({
      bearingTrue: null,
      distanceNauticalMiles: 0,
    });
  });
});
