import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  celsius,
  degrees,
  hectopascals,
  metres,
  metresToNauticalMiles,
  magneticDegrees,
  normaliseDegrees,
  signedDegrees,
  toDegrees,
  toRadians,
  trueDegrees,
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
    expect(() => celsius(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => hectopascals(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('enforces bounded true and magnetic references independently', () => {
    const trueBearing = trueDegrees(359.9);
    const magneticBearing = magneticDegrees(12);
    expect(trueBearing).toBe(359.9);
    expect(magneticBearing).toBe(12);
    expectTypeOf(trueBearing).not.toMatchTypeOf(magneticBearing);
    expect(() => trueDegrees(360)).toThrow(RangeError);
    expect(() => magneticDegrees(-1)).toThrow(RangeError);
  });

  it('bounds signed angular offsets without normalising their direction', () => {
    expect(signedDegrees(-12.5)).toBe(-12.5);
    expect(() => signedDegrees(181)).toThrow(RangeError);
  });
});
