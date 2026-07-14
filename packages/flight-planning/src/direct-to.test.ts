import { describe, expect, it } from 'vitest';

import { position } from '@driftline/geospatial';

import { calculateDirectToNavigation } from './direct-to';

describe('direct-to navigation', () => {
  it('derives one great-circle target without route mutation', () => {
    const result = calculateDirectToNavigation({
      current: position(0, 0),
      groundspeedKnots: 120,
      target: { identifier: 'DEST', position: position(0, 1) },
    });
    expect(result.distance).toBeCloseTo(60, 0);
    expect(result.estimatedMinutes).toBeCloseTo(30, 0);
    expect(result.trueBearing).toBe(90);
  });

  it('withholds bearing at the target and ETE without positive groundspeed', () => {
    expect(
      calculateDirectToNavigation({
        current: position(12, 77),
        groundspeedKnots: 0,
        target: { identifier: 'DEST', position: position(12, 77) },
      }),
    ).toMatchObject({ distance: 0, estimatedMinutes: null, trueBearing: null });
  });
});
