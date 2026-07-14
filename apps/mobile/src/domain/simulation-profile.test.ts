import { describe, expect, it } from 'vitest';

import { defaultSimulationProfile, parseSimulationProfileText } from './simulation-profile';

const textFixture = () => ({
  altitudeFeet: '4500',
  groundspeedKnots: '118',
  horizontalAccuracyMetres: '50',
  startingAirportIdentifier: 'dvl1',
  trackTrueDegrees: '68',
  verticalSpeedFeetPerMinute: '0',
});

describe('simulation profile boundary', () => {
  it('normalises a complete explicit kinematic profile', () => {
    expect(parseSimulationProfileText(textFixture())).toEqual(defaultSimulationProfile);
  });

  it.each([
    ['altitudeFeet', '100001'],
    ['groundspeedKnots', '-1'],
    ['horizontalAccuracyMetres', 'Infinity'],
    ['trackTrueDegrees', '360'],
    ['verticalSpeedFeetPerMinute', '-10001'],
  ] as const)('rejects invalid %s', (field, value) => {
    expect(() => parseSimulationProfileText({ ...textFixture(), [field]: value })).toThrow();
  });
});
