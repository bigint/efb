import { describe, expect, it } from 'vitest';

import { moveRouteWaypoint } from './route-editing';

describe('route editing', () => {
  it('moves one unique waypoint without mutating the source', () => {
    const source = ['DVL1', 'DVL2', 'DVL3'];
    expect(moveRouteWaypoint(source, 2, 1)).toEqual(['DVL1', 'DVL3', 'DVL2']);
    expect(source).toEqual(['DVL1', 'DVL2', 'DVL3']);
  });

  it('rejects out-of-range indexes and an ambiguous duplicate route', () => {
    expect(() => moveRouteWaypoint(['DVL1'], 0, 1)).toThrow('outside');
    expect(() => moveRouteWaypoint(['DVL1', 'DVL1'], 0, 1)).toThrow('unique');
  });
});
