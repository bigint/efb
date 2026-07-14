import {
  degrees,
  knots,
  toRadians,
  type Knots,
  type TrueDegrees,
} from '@driftline/data-contracts';

export interface RunwayWindComponents {
  readonly crosswind: {
    readonly from: 'left' | 'none' | 'right';
    readonly speed: Knots;
  };
  readonly longitudinal: {
    readonly kind: 'headwind' | 'none' | 'tailwind';
    readonly speed: Knots;
  };
}

const nearZero = (value: number): boolean => Math.abs(value) <= 1e-9;
const validTrueDegrees = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value < 360;

export const calculateRunwayWindComponents = (
  runwayHeading: TrueDegrees,
  windFrom: TrueDegrees,
  windSpeed: Knots,
): RunwayWindComponents => {
  if (!validTrueDegrees(runwayHeading) || !validTrueDegrees(windFrom)) {
    throw new RangeError('Runway and wind directions must be true degrees in [0, 360)');
  }
  if (!Number.isFinite(windSpeed) || windSpeed < 0 || windSpeed > 300) {
    throw new RangeError('Runway wind speed must be from 0 through 300 KT');
  }
  const relativeRadians = toRadians(degrees(Number(windFrom) - Number(runwayHeading)));
  const longitudinal = windSpeed * Math.cos(relativeRadians);
  const crosswind = windSpeed * Math.sin(relativeRadians);
  return {
    crosswind: {
      from: nearZero(crosswind) ? 'none' : crosswind > 0 ? 'right' : 'left',
      speed: knots(nearZero(crosswind) ? 0 : Math.abs(crosswind)),
    },
    longitudinal: {
      kind: nearZero(longitudinal) ? 'none' : longitudinal > 0 ? 'headwind' : 'tailwind',
      speed: knots(nearZero(longitudinal) ? 0 : Math.abs(longitudinal)),
    },
  };
};
