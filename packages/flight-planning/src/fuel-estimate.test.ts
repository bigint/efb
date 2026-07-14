import { describe, expect, it } from 'vitest';

import { calculateCruiseFuelEstimate } from './fuel-estimate';

describe('cruise-only fuel estimate', () => {
  it('compares wind-adjusted cruise consumption with entered usable fuel', () => {
    expect(
      calculateCruiseFuelEstimate({
        estimatedMinutes: 90,
        fuelBurnLitresPerHour: 32,
        usableFuelLitres: 50,
      }),
    ).toEqual({
      kind: 'ready',
      requiredLitres: 48,
      usableFuelLitres: 50,
      withinEnteredUsableFuel: true,
    });
  });

  it('distinguishes missing aircraft from invalid route assumptions', () => {
    expect(
      calculateCruiseFuelEstimate({
        estimatedMinutes: 60,
        fuelBurnLitresPerHour: null,
        usableFuelLitres: null,
      }),
    ).toEqual({ kind: 'unavailable', reason: 'missing-aircraft' });
    expect(
      calculateCruiseFuelEstimate({
        estimatedMinutes: Number.NaN,
        fuelBurnLitresPerHour: 32,
        usableFuelLitres: 180,
      }),
    ).toEqual({ kind: 'unavailable', reason: 'invalid-input' });
  });
});
