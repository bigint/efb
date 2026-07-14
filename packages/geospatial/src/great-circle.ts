import {
  degrees,
  metres,
  metresToNauticalMiles,
  normaliseDegrees,
  radians,
  toDegrees,
  toRadians,
  trueDegrees,
  type Metres,
  type NauticalMiles,
  type Radians,
  type TrueDegrees,
} from '@driftline/data-contracts';

import { position, type Position } from './position';

// IUGG mean Earth radius. Spherical results are appropriate for display and initial
// GA planning only; future authoritative computations may use an ellipsoidal model.
const EARTH_MEAN_RADIUS_METRES = metres(6_371_008.8);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const angularDistance = (from: Position, to: Position): Radians => {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const deltaLatitude = toLatitude - fromLatitude;
  const deltaLongitude = toRadians(degrees(to.longitude - from.longitude));
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  const boundedHaversine = clamp(haversine, 0, 1);
  const angle = 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
  return radians(angle <= 1e-12 ? 0 : angle);
};

export const greatCircleDistanceMetres = (from: Position, to: Position): Metres =>
  metres(angularDistance(from, to) * EARTH_MEAN_RADIUS_METRES);

export const greatCircleDistance = (from: Position, to: Position): NauticalMiles =>
  metresToNauticalMiles(greatCircleDistanceMetres(from, to));

export const initialTrueBearing = (from: Position, to: Position): TrueDegrees => {
  const distance = angularDistance(from, to);
  if (distance === 0) {
    throw new RangeError('Bearing is undefined for identical positions');
  }
  if (Math.abs(Math.PI - distance) <= 1e-12) {
    throw new RangeError('Bearing is undefined for antipodal positions');
  }
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const deltaLongitude = toRadians(degrees(to.longitude - from.longitude));
  const y = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);
  return trueDegrees(normaliseDegrees(toDegrees(radians(Math.atan2(y, x)))));
};

export const destinationPoint = (
  from: Position,
  bearing: TrueDegrees,
  distance: NauticalMiles,
): Position => {
  const angular = (distance * 1852) / EARTH_MEAN_RADIUS_METRES;
  const bearingRadians = toRadians(bearing);
  const latitude = toRadians(from.latitude);
  const longitude = toRadians(from.longitude);
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angular) +
      Math.cos(latitude) * Math.sin(angular) * Math.cos(bearingRadians),
  );
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angular) * Math.cos(latitude),
      Math.cos(angular) - Math.sin(latitude) * Math.sin(destinationLatitude),
    );
  const wrappedLongitude = ((toDegrees(radians(destinationLongitude)) + 540) % 360) - 180;
  return position(toDegrees(radians(destinationLatitude)), wrappedLongitude);
};

export interface TrackOffset {
  /** Negative is left of course and positive is right of course. */
  readonly crossTrack: NauticalMiles;
  readonly alongTrack: NauticalMiles;
}

export const trackOffset = (start: Position, end: Position, current: Position): TrackOffset => {
  const routeAngularDistance = angularDistance(start, end);
  if (routeAngularDistance === 0) throw new RangeError('Track requires distinct endpoints');
  const currentAngularDistance = angularDistance(start, current);
  if (currentAngularDistance === 0) {
    return {
      alongTrack: metresToNauticalMiles(metres(0)),
      crossTrack: metresToNauticalMiles(metres(0)),
    };
  }
  const routeBearing = toRadians(initialTrueBearing(start, end));
  const currentBearing = toRadians(initialTrueBearing(start, current));
  const crossTrackAngular = Math.asin(
    clamp(Math.sin(currentAngularDistance) * Math.sin(currentBearing - routeBearing), -1, 1),
  );
  const alongTrackAngular = Math.atan2(
    Math.sin(currentAngularDistance) * Math.cos(currentBearing - routeBearing),
    Math.cos(currentAngularDistance),
  );
  return {
    alongTrack: metresToNauticalMiles(metres(alongTrackAngular * EARTH_MEAN_RADIUS_METRES)),
    crossTrack: metresToNauticalMiles(metres(crossTrackAngular * EARTH_MEAN_RADIUS_METRES)),
  };
};
