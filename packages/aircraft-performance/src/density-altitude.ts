import {
  celsius,
  feet,
  type Celsius,
  type Feet,
  type Hectopascals,
} from '@driftline/data-contracts';

const HECTOPASCALS_PER_INCH_MERCURY = 33.863_886_666_7;
const STANDARD_ALTIMETER_INCHES_MERCURY = 29.92;
const ISA_LAPSE_CELSIUS_PER_THOUSAND_FEET = 1.98;
const DENSITY_ALTITUDE_FEET_PER_CELSIUS = 120;

export interface DensityAltitudeInput {
  readonly altimeterHectopascals: Hectopascals;
  readonly fieldElevationFeet: Feet;
  readonly outsideAirTemperatureCelsius: Celsius;
}

export type DensityAltitudeEstimate =
  | {
      readonly densityAltitudeFeet: Feet;
      readonly isaTemperatureCelsius: Celsius;
      readonly kind: 'ready';
      readonly pressureAltitudeFeet: Feet;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: 'approximation-out-of-range' | 'input-out-of-range';
    };

/**
 * FAA rule-of-thumb estimate for planning education, not an aircraft performance result.
 * Humidity, instrument error, and aircraft-specific approved performance data are excluded.
 */
export const estimateDensityAltitude = ({
  altimeterHectopascals,
  fieldElevationFeet,
  outsideAirTemperatureCelsius,
}: DensityAltitudeInput): DensityAltitudeEstimate => {
  if (
    altimeterHectopascals < 850 ||
    altimeterHectopascals > 1_085 ||
    fieldElevationFeet < -1_500 ||
    fieldElevationFeet > 15_000 ||
    outsideAirTemperatureCelsius < -80 ||
    outsideAirTemperatureCelsius > 60
  ) {
    return { kind: 'unavailable', reason: 'input-out-of-range' };
  }

  const altimeterInchesMercury = altimeterHectopascals / HECTOPASCALS_PER_INCH_MERCURY;
  const pressureAltitude =
    fieldElevationFeet + (STANDARD_ALTIMETER_INCHES_MERCURY - altimeterInchesMercury) * 1_000;
  if (pressureAltitude < -2_000 || pressureAltitude > 18_000) {
    return { kind: 'unavailable', reason: 'approximation-out-of-range' };
  }
  const isaTemperature = 15 - (pressureAltitude / 1_000) * ISA_LAPSE_CELSIUS_PER_THOUSAND_FEET;
  const densityAltitude =
    pressureAltitude +
    (outsideAirTemperatureCelsius - isaTemperature) * DENSITY_ALTITUDE_FEET_PER_CELSIUS;
  if (
    !Number.isFinite(densityAltitude) ||
    densityAltitude < -5_000 ||
    densityAltitude > 30_000
  ) {
    return { kind: 'unavailable', reason: 'approximation-out-of-range' };
  }
  return {
    densityAltitudeFeet: feet(densityAltitude),
    isaTemperatureCelsius: celsius(isaTemperature),
    kind: 'ready',
    pressureAltitudeFeet: feet(pressureAltitude),
  };
};
