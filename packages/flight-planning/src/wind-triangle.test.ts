import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { knots, trueDegrees } from '@driftline/data-contracts';

import { solveWindTriangle } from './wind-triangle';

describe('true-reference wind triangle', () => {
  it('solves headwind, tailwind, and crosswind cases', () => {
    expect(
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(100),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(20),
      }),
    ).toMatchObject({ groundspeed: 80, headingTrue: 0, status: 'solved', windCorrection: 0 });
    expect(
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(100),
        windFromTrue: trueDegrees(180),
        windSpeed: knots(20),
      }),
    ).toMatchObject({ groundspeed: 120, headingTrue: 0, status: 'solved', windCorrection: 0 });
    const crosswind = solveWindTriangle({
      desiredCourseTrue: trueDegrees(0),
      trueAirspeed: knots(100),
      windFromTrue: trueDegrees(270),
      windSpeed: knots(20),
    });
    expect(crosswind.status).toBe('solved');
    if (crosswind.status === 'solved') {
      expect(crosswind.windCorrection).toBeCloseTo(-11.537, 3);
      expect(crosswind.headingTrue).toBeCloseTo(348.463, 3);
      expect(crosswind.groundspeed).toBeCloseTo(97.98, 2);
    }
  });

  it('returns explicit no-solution states', () => {
    expect(
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(50),
        windFromTrue: trueDegrees(270),
        windSpeed: knots(60),
      }),
    ).toEqual({ reason: 'crosswind-exceeds-airspeed', status: 'no-solution' });
    expect(
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(50),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(50),
      }),
    ).toEqual({ reason: 'no-forward-progress', status: 'no-solution' });
  });

  it('rejects invalid speed domains', () => {
    expect(() =>
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(0),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(1),
      }),
    ).toThrow(RangeError);
    expect(() =>
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(100),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(-1),
      }),
    ).toThrow(RangeError);
    expect(() =>
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(1_001),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(0),
      }),
    ).toThrow('1,000');
    expect(() =>
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(100),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(501),
      }),
    ).toThrow('500');
    expect(() =>
      solveWindTriangle({
        desiredCourseTrue: 360 as never,
        trueAirspeed: knots(100),
        windFromTrue: trueDegrees(0),
        windSpeed: knots(0),
      }),
    ).toThrow('direction');
    expect(() =>
      solveWindTriangle({
        desiredCourseTrue: trueDegrees(0),
        trueAirspeed: knots(100),
        windFromTrue: Number.NaN as never,
        windSpeed: knots(0),
      }),
    ).toThrow('direction');
  });

  it('reconstructs the requested ground track from solved vectors', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 359.999, noNaN: true }),
        fc.double({ min: 40, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 359.999, noNaN: true }),
        fc.double({ min: 0, max: 35, noNaN: true }),
        (course, airspeed, windFrom, windSpeed) => {
          const result = solveWindTriangle({
            desiredCourseTrue: trueDegrees(course),
            trueAirspeed: knots(airspeed),
            windFromTrue: trueDegrees(windFrom),
            windSpeed: knots(windSpeed),
          });
          expect(result.status).toBe('solved');
          if (result.status !== 'solved') return;
          const radians = (value: number) => (value * Math.PI) / 180;
          const east =
            airspeed * Math.sin(radians(result.headingTrue)) +
            windSpeed * Math.sin(radians(windFrom + 180));
          const north =
            airspeed * Math.cos(radians(result.headingTrue)) +
            windSpeed * Math.cos(radians(windFrom + 180));
          const reconstructed = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
          const error = Math.abs(((reconstructed - course + 540) % 360) - 180);
          expect(error).toBeLessThan(1e-9);
          expect(Math.hypot(east, north)).toBeCloseTo(result.groundspeed, 9);
        },
      ),
      { numRuns: 500 },
    );
  });
});
