import { describe, expect, it } from 'vitest';

import { knots, trueDegrees } from '@driftline/data-contracts';

import { calculateRunwayWindComponents } from './runway-wind';

describe('true-reference runway wind components', () => {
  it('distinguishes headwind and tailwind', () => {
    expect(calculateRunwayWindComponents(trueDegrees(0), trueDegrees(0), knots(20))).toEqual({
      crosswind: { from: 'none', speed: 0 },
      longitudinal: { kind: 'headwind', speed: 20 },
    });
    expect(calculateRunwayWindComponents(trueDegrees(0), trueDegrees(180), knots(20))).toEqual({
      crosswind: { from: 'none', speed: 0 },
      longitudinal: { kind: 'tailwind', speed: 20 },
    });
  });

  it('reports the side the crosswind comes from', () => {
    expect(calculateRunwayWindComponents(trueDegrees(0), trueDegrees(90), knots(20))).toEqual({
      crosswind: { from: 'right', speed: 20 },
      longitudinal: { kind: 'none', speed: 0 },
    });
    expect(calculateRunwayWindComponents(trueDegrees(0), trueDegrees(270), knots(20))).toEqual({
      crosswind: { from: 'left', speed: 20 },
      longitudinal: { kind: 'none', speed: 0 },
    });
  });

  it('calculates oblique components and rejects unsupported speeds', () => {
    const result = calculateRunwayWindComponents(trueDegrees(45), trueDegrees(90), knots(10));
    expect(result.longitudinal.speed).toBeCloseTo(Math.sqrt(50), 10);
    expect(result.crosswind.speed).toBeCloseTo(Math.sqrt(50), 10);
    expect(() =>
      calculateRunwayWindComponents(trueDegrees(0), trueDegrees(0), knots(-1)),
    ).toThrow(RangeError);
  });
});
