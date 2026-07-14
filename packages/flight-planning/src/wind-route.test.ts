import { describe, expect, it } from 'vitest';

import { knots, trueDegrees } from '@driftline/data-contracts';
import { position } from '@driftline/geospatial';

import { calculateWindAdjustedRoute } from './wind-route';

const eastbound = [
  { identifier: 'A', position: position(0, 0) },
  { identifier: 'B', position: position(0, 1) },
] as const;

describe('wind-adjusted route', () => {
  it('uses each leg course and solved groundspeed for ETE', () => {
    const calm = calculateWindAdjustedRoute({
      trueAirspeed: knots(100),
      waypoints: eastbound,
      windFromTrue: trueDegrees(0),
      windSpeed: knots(0),
    });
    const headwind = calculateWindAdjustedRoute({
      trueAirspeed: knots(100),
      waypoints: eastbound,
      windFromTrue: trueDegrees(90),
      windSpeed: knots(20),
    });
    expect(calm.status).toBe('ready');
    expect(headwind.status).toBe('ready');
    if (calm.status === 'ready' && headwind.status === 'ready') {
      expect(calm.legs[0]?.wind.groundspeed).toBeCloseTo(100, 10);
      expect(headwind.legs[0]?.wind.groundspeed).toBeCloseTo(80, 10);
      expect(headwind.estimatedMinutes).toBeGreaterThan(calm.estimatedMinutes);
    }
  });

  it('preserves incomplete route state and identifies the failed leg', () => {
    expect(
      calculateWindAdjustedRoute({
        trueAirspeed: knots(100),
        waypoints: [eastbound[0]],
        windFromTrue: trueDegrees(0),
        windSpeed: knots(0),
      }),
    ).toEqual({ estimatedMinutes: null, legs: [], status: 'incomplete', totalDistance: null });
    const blocked = calculateWindAdjustedRoute({
      trueAirspeed: knots(50),
      waypoints: eastbound,
      windFromTrue: trueDegrees(0),
      windSpeed: knots(60),
    });
    expect(blocked).toMatchObject({
      failedLeg: { from: { identifier: 'A' }, to: { identifier: 'B' } },
      reason: 'crosswind-exceeds-airspeed',
      status: 'no-solution',
    });
  });
});
