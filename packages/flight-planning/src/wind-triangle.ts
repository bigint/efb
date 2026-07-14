import {
  knots,
  signedDegrees,
  trueDegrees,
  type Knots,
  type SignedDegrees,
  type TrueDegrees,
} from '@driftline/data-contracts';

export type WindTriangleResult =
  | {
      readonly groundspeed: Knots;
      readonly headingTrue: TrueDegrees;
      readonly status: 'solved';
      /** Negative is a correction left of desired course; positive is right. */
      readonly windCorrection: SignedDegrees;
    }
  | {
      readonly reason: 'crosswind-exceeds-airspeed' | 'no-forward-progress';
      readonly status: 'no-solution';
    };

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
const normalise = (degrees: number): number => ((degrees % 360) + 360) % 360;
const MAXIMUM_TRUE_AIRSPEED_KNOTS = 1_000;
const MAXIMUM_WIND_SPEED_KNOTS = 500;
const validTrueDegrees = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value < 360;

/**
 * Solves the planar wind triangle for a desired true ground track. Wind direction follows the
 * aviation convention: the true direction the wind is coming from.
 */
export const solveWindTriangle = ({
  desiredCourseTrue,
  trueAirspeed,
  windFromTrue,
  windSpeed,
}: {
  readonly desiredCourseTrue: TrueDegrees;
  readonly trueAirspeed: Knots;
  readonly windFromTrue: TrueDegrees;
  readonly windSpeed: Knots;
}): WindTriangleResult => {
  if (!validTrueDegrees(desiredCourseTrue) || !validTrueDegrees(windFromTrue)) {
    throw new RangeError('Course and wind direction must be true degrees in [0, 360)');
  }
  if (
    !Number.isFinite(trueAirspeed) ||
    trueAirspeed <= 0 ||
    trueAirspeed > MAXIMUM_TRUE_AIRSPEED_KNOTS
  ) {
    throw new RangeError('True airspeed must be from above 0 through 1,000 KT');
  }
  if (!Number.isFinite(windSpeed) || windSpeed < 0 || windSpeed > MAXIMUM_WIND_SPEED_KNOTS) {
    throw new RangeError('Wind speed must be from 0 through 500 KT');
  }

  const relativeWindTo = toRadians(normalise(windFromTrue + 180 - desiredCourseTrue));
  const windAlong = windSpeed * Math.cos(relativeWindTo);
  const windRight = windSpeed * Math.sin(relativeWindTo);
  const correctionRatio = -windRight / trueAirspeed;
  if (Math.abs(correctionRatio) > 1) {
    return { reason: 'crosswind-exceeds-airspeed', status: 'no-solution' };
  }
  const correctionRadians = Math.asin(correctionRatio);
  const groundspeed = trueAirspeed * Math.cos(correctionRadians) + windAlong;
  if (groundspeed <= 1e-9) return { reason: 'no-forward-progress', status: 'no-solution' };
  const rawCorrectionDegrees = toDegrees(correctionRadians);
  const correctionDegrees = Math.abs(rawCorrectionDegrees) < 1e-12 ? 0 : rawCorrectionDegrees;
  return {
    groundspeed: knots(groundspeed),
    headingTrue: trueDegrees(normalise(desiredCourseTrue + correctionDegrees)),
    status: 'solved',
    windCorrection: signedDegrees(correctionDegrees),
  };
};
