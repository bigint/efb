import { describe, expect, it } from 'vitest';

import { celsius, feet, hectopascals } from '@driftline/data-contracts';

import { estimateDensityAltitude } from './density-altitude';

const standardAltimeter = hectopascals(29.92 * 33.863_886_666_7);

describe('density altitude rule-of-thumb estimate', () => {
  it('returns sea-level standard-atmosphere conditions at approximately zero feet', () => {
    expect(
      estimateDensityAltitude({
        altimeterHectopascals: standardAltimeter,
        fieldElevationFeet: feet(0),
        outsideAirTemperatureCelsius: celsius(15),
      }),
    ).toMatchObject({
      densityAltitudeFeet: 0,
      isaTemperatureCelsius: 15,
      kind: 'ready',
      pressureAltitudeFeet: 0,
    });
  });

  it('applies the documented FAA temperature rule of thumb', () => {
    const result = estimateDensityAltitude({
      altimeterHectopascals: standardAltimeter,
      fieldElevationFeet: feet(5_000),
      outsideAirTemperatureCelsius: celsius(30),
    });
    expect(result).toMatchObject({ kind: 'ready' });
    if (result.kind !== 'ready') throw new Error('Expected a density-altitude estimate.');
    expect(result.pressureAltitudeFeet).toBeCloseTo(5_000, 6);
    expect(result.isaTemperatureCelsius).toBeCloseTo(5.1, 6);
    expect(result.densityAltitudeFeet).toBeCloseTo(7_988, 6);
  });

  it('fails closed outside the bounded educational approximation', () => {
    expect(
      estimateDensityAltitude({
        altimeterHectopascals: hectopascals(700),
        fieldElevationFeet: feet(0),
        outsideAirTemperatureCelsius: celsius(15),
      }),
    ).toEqual({ kind: 'unavailable', reason: 'input-out-of-range' });
    expect(
      estimateDensityAltitude({
        altimeterHectopascals: hectopascals(850),
        fieldElevationFeet: feet(15_000),
        outsideAirTemperatureCelsius: celsius(60),
      }),
    ).toEqual({ kind: 'unavailable', reason: 'approximation-out-of-range' });
  });
});
