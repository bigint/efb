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

  it('increases exactly 120 feet per Celsius degree at fixed pressure altitude', () => {
    const estimates = [0, 10, 20, 30].map((temperature) =>
      estimateDensityAltitude({
        altimeterHectopascals: standardAltimeter,
        fieldElevationFeet: feet(3_000),
        outsideAirTemperatureCelsius: celsius(temperature),
      }),
    );
    for (let index = 1; index < estimates.length; index += 1) {
      const previous = estimates[index - 1];
      const current = estimates[index];
      if (previous?.kind !== 'ready' || current?.kind !== 'ready') {
        throw new Error('Expected bounded density-altitude estimates.');
      }
      expect(current.densityAltitudeFeet - previous.densityAltitudeFeet).toBeCloseTo(1_200, 8);
    }
  });

  it('increases pressure and density altitude as the altimeter setting falls', () => {
    const estimates = [1_030, 1_013, 990].map((altimeter) =>
      estimateDensityAltitude({
        altimeterHectopascals: hectopascals(altimeter),
        fieldElevationFeet: feet(2_000),
        outsideAirTemperatureCelsius: celsius(20),
      }),
    );
    for (let index = 1; index < estimates.length; index += 1) {
      const previous = estimates[index - 1];
      const current = estimates[index];
      if (previous?.kind !== 'ready' || current?.kind !== 'ready') {
        throw new Error('Expected bounded density-altitude estimates.');
      }
      expect(current.pressureAltitudeFeet).toBeGreaterThan(previous.pressureAltitudeFeet);
      expect(current.densityAltitudeFeet).toBeGreaterThan(previous.densityAltitudeFeet);
    }
  });
});
