import { describe, expect, it } from 'vitest';

import {
  parsePersistedFlightState,
  safePersistedFlightState,
  sanitisePersistedJson,
} from './persisted-flight';

const validState = {
  positionScenario: { gpsAvailable: true, kind: 'simulated' as const },
  routeIdentifiers: ['DVL1', 'DVL2'],
  selectedAirport: 'DVL1',
  workspace: 'map' as const,
};

describe('persisted flight recovery', () => {
  it('accepts an exact valid persisted state', () => {
    expect(parsePersistedFlightState(validState)).toEqual(validState);
  });

  it.each([
    { ...validState, routeIdentifiers: ['DVL1', 'DVL1'] },
    { ...validState, routeIdentifiers: [''] },
    { ...validState, workspace: 'unknown' },
    { ...validState, unexpected: true },
  ])('fails closed for invalid state %#', (value) => {
    expect(parsePersistedFlightState(value)).toEqual(safePersistedFlightState);
  });

  it('replaces malformed JSON with an unavailable recovery envelope', () => {
    const recovered = sanitisePersistedJson('{broken', 2);
    expect(recovered).not.toBeNull();
    expect(JSON.parse(recovered ?? '')).toEqual({
      state: safePersistedFlightState,
      version: 2,
    });
  });
});
