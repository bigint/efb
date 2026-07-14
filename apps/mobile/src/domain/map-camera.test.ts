import { describe, expect, it } from 'vitest';

import type { PositionEvaluation } from './position-source';
import { resolveMapCamera } from './map-camera';

const available: PositionEvaluation = {
  ageMilliseconds: 250,
  kind: 'available',
  origin: 'simulated',
  sample: {
    altitudeFeet: 3_000,
    groundspeedKnots: 100,
    horizontalAccuracyMetres: 5,
    latitude: 12,
    longitude: 77,
    sampledAt: 1_000,
    trackDegrees: 245,
    trackReference: 'true',
  },
};

describe('map camera orientation', () => {
  it('resolves a fresh track-up camera without relabelling its reference', () => {
    expect(resolveMapCamera('track-up', available)).toEqual({
      bearing: 245,
      center: [77, 12],
      kind: 'track-up',
      reference: 'true',
    });
  });

  it('fails track-up to north when position or course is unavailable', () => {
    expect(
      resolveMapCamera('track-up', { kind: 'unavailable', reason: 'stale-sample' }),
    ).toMatchObject({ bearing: 0, kind: 'track-up-unavailable' });
    expect(
      resolveMapCamera('track-up', {
        ...available,
        sample: { ...available.sample, trackDegrees: null },
      }),
    ).toEqual({ bearing: 0, kind: 'track-up-unavailable', reason: 'course-unavailable' });
  });

  it('keeps north-up independent from position availability', () => {
    expect(resolveMapCamera('north-up', { kind: 'unavailable', reason: 'gps-outage' })).toEqual(
      { bearing: 0, kind: 'north-up' },
    );
  });
});
