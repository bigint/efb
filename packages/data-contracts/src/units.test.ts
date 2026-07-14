import { describe, expect, it } from 'vitest';

import {
  degrees,
  metres,
  metresToNauticalMiles,
  normaliseDegrees,
  toDegrees,
  toRadians,
} from './units';

describe('typed unit conversions', () => {
  it('round trips degrees and radians', () => {
    expect(toDegrees(toRadians(degrees(123.45)))).toBeCloseTo(123.45, 12);
  });

  it('converts the defined international nautical mile', () => {
    expect(metresToNauticalMiles(metres(1852))).toBe(1);
  });

  it.each([
    [-1, 359],
    [361, 1],
    [720, 0],
  ])('normalises %s degrees to %s', (input, expected) => {
    expect(normaliseDegrees(degrees(input))).toBe(expected);
  });

  it('rejects non-finite values at the boundary', () => {
    expect(() => metres(Number.NaN)).toThrow(RangeError);
  });
});
