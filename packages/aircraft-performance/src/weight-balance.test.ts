import { describe, expect, it } from 'vitest';

import { kilograms, metres } from '@driftline/data-contracts';

import {
  calculateLoadingSummary,
  calculateWeightBalance,
  type WeightBalanceInput,
} from './weight-balance';

const envelope = [
  { arm: metres(0.8), mass: kilograms(600) },
  { arm: metres(1.05), mass: kilograms(600) },
  { arm: metres(1.05), mass: kilograms(1_200) },
  { arm: metres(0.9), mass: kilograms(1_200) },
] as const;

const validInput: WeightBalanceInput = {
  envelope,
  maximumMass: kilograms(1_200),
  stations: [
    { arm: metres(0.9), id: 'empty-aircraft', mass: kilograms(700) },
    { arm: metres(1.2), id: 'occupants', mass: kilograms(160) },
    { arm: metres(1.0), id: 'fuel', mass: kilograms(100) },
  ],
};

describe('generic weight and balance', () => {
  it('calculates mass, moment and CG with explicit units', () => {
    const result = calculateWeightBalance(validInput);
    expect(result.totalMass).toBe(960);
    expect(result.totalMoment).toBe(922);
    expect(result.centreOfGravityArm).toBeCloseTo(0.9604, 4);
    expect(result.violations).toEqual([]);
  });

  it('reports mass and moment without inventing a CG envelope decision', () => {
    expect(
      calculateLoadingSummary({
        maximumMass: validInput.maximumMass,
        stations: validInput.stations,
      }),
    ).toMatchObject({ massWithinLimit: true, totalMass: 960, totalMoment: 922 });
  });

  it('treats an envelope boundary as valid', () => {
    const result = calculateWeightBalance({
      ...validInput,
      stations: [{ arm: metres(0.8), id: 'boundary', mass: kilograms(600) }],
    });
    expect(result.insideEnvelope).toBe(true);
  });

  it('reports mass and envelope violations independently', () => {
    const result = calculateWeightBalance({
      ...validInput,
      maximumMass: kilograms(900),
      stations: [{ arm: metres(1.3), id: 'invalid-load', mass: kilograms(1_000) }],
    });
    expect(result.violations).toEqual(['above-maximum-mass', 'outside-envelope']);
  });

  it('fails closed for invalid profiles and loading inputs', () => {
    expect(() =>
      calculateWeightBalance({ ...validInput, envelope: envelope.slice(0, 2) }),
    ).toThrow(RangeError);
    expect(() =>
      calculateWeightBalance({
        ...validInput,
        stations: [{ arm: metres(1), id: 'negative', mass: kilograms(-1) }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateWeightBalance({
        ...validInput,
        stations: [{ arm: metres(1), id: 'zero', mass: kilograms(0) }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateWeightBalance({
        ...validInput,
        envelope: [
          { arm: metres(0.8), mass: kilograms(600) },
          { arm: metres(1.1), mass: kilograms(1_200) },
          { arm: metres(0.8), mass: kilograms(1_200) },
          { arm: metres(1.2), mass: kilograms(600) },
        ],
      }),
    ).toThrow('intersect');
  });
});
