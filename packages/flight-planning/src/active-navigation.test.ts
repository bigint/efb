import { describe, expect, it } from 'vitest';

import { position } from '@driftline/geospatial';

import { calculateActiveLegNavigation } from './active-navigation';

const waypoints = [
  { identifier: 'A', position: position(0, 0) },
  { identifier: 'B', position: position(0, 1) },
  { identifier: 'C', position: position(0, 2) },
];

describe('explicit active-leg navigation', () => {
  it('calculates next, cross-track, remaining distance, and ETE for the selected leg', () => {
    const result = calculateActiveLegNavigation({
      activeLegIndex: 0,
      current: position(-0.1, 0.5),
      groundspeedKnots: 120,
      waypoints,
    });
    expect(result).toMatchObject({ nextIdentifier: 'B', status: 'ready' });
    if (result.status !== 'ready') throw new Error('Expected ready navigation');
    expect(result.crossTrack).toBeGreaterThan(6);
    expect(result.distanceToNext).toBeGreaterThan(30);
    expect(result.routeRemaining).toBeGreaterThan(90);
    expect(result.estimatedMinutesRemaining).toBeGreaterThan(45);
    expect(result.trueBearingToNext).not.toBeNull();
  });

  it('requires an explicit in-range leg and does not invent ETE without groundspeed', () => {
    expect(
      calculateActiveLegNavigation({
        activeLegIndex: null,
        current: position(0, 0),
        groundspeedKnots: 120,
        waypoints,
      }),
    ).toEqual({ reason: 'no-active-leg', status: 'unavailable' });
    expect(
      calculateActiveLegNavigation({
        activeLegIndex: 2,
        current: position(0, 0),
        groundspeedKnots: 120,
        waypoints,
      }),
    ).toEqual({ reason: 'invalid-active-leg', status: 'unavailable' });
    expect(
      calculateActiveLegNavigation({
        activeLegIndex: 0,
        current: position(0, 0.5),
        groundspeedKnots: null,
        waypoints,
      }),
    ).toMatchObject({ estimatedMinutesRemaining: null, status: 'ready' });
    expect(
      calculateActiveLegNavigation({
        activeLegIndex: 0,
        current: position(0, 0.5),
        groundspeedKnots: 1_001,
        waypoints,
      }),
    ).toMatchObject({ estimatedMinutesRemaining: null, status: 'ready' });
  });
});
