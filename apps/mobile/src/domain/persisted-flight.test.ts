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
  it('accepts the records workspace as a recoverable destination', () => {
    expect(parsePersistedFlightState({ ...validState, workspace: 'records' }).workspace).toBe(
      'records',
    );
  });

  it('accepts the local library as a recoverable destination', () => {
    expect(parsePersistedFlightState({ ...validState, workspace: 'library' }).workspace).toBe(
      'library',
    );
  });

  it('accepts an exact valid persisted state', () => {
    expect(parsePersistedFlightState(validState)).toEqual(validState);
    expect(parsePersistedFlightState({ ...validState, workspace: 'weather' }).workspace).toBe(
      'weather',
    );
  });

  it('restores device intent only in the checking state', () => {
    expect(
      parsePersistedFlightState({
        ...validState,
        positionScenario: { kind: 'device', status: 'checking' },
      }).positionScenario,
    ).toEqual({ kind: 'device', status: 'checking' });
    expect(
      parsePersistedFlightState({
        ...validState,
        positionScenario: { kind: 'device', status: 'watching' },
      }),
    ).toEqual(safePersistedFlightState);
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
