import { describe, expect, it } from 'vitest';

import { position } from '@driftline/geospatial';

import { inspectMapPoint } from './map-inspection';

describe('map point inspection', () => {
  it('returns the nearest validated airport with true bearing and distance', () => {
    expect(
      inspectMapPoint(0, 0, [
        { identifier: 'EAST', position: position(0, 1) },
        { identifier: 'FAR', position: position(10, 10) },
      ]),
    ).toMatchObject({
      latitude: 0,
      longitude: 0,
      nearest: { bearingTrue: 90, identifier: 'EAST' },
    });
  });

  it('supports no airport candidates and rejects ambiguous inputs', () => {
    expect(inspectMapPoint(77, 12, []).nearest).toBeNull();
    expect(() =>
      inspectMapPoint(77, 12, [
        { identifier: 'DUP', position: position(12, 77) },
        { identifier: 'DUP', position: position(13, 78) },
      ]),
    ).toThrow('unique');
    expect(() => inspectMapPoint(181, 12, [])).toThrow();
  });
});
