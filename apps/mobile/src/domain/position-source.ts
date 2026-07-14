import { nauticalMiles, trueDegrees } from '@driftline/data-contracts';
import { destinationPoint, position, type Position } from '@driftline/geospatial';

export interface PositionSample {
  readonly altitudeFeet: number | null;
  readonly groundspeedKnots: number | null;
  readonly horizontalAccuracyMetres: number | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly sampledAt: number;
  readonly trackDegrees: number | null;
  readonly trackReference: 'platform' | 'true';
}

export type PositionScenario =
  | { readonly kind: 'disabled' }
  | {
      readonly kind: 'device';
      readonly status:
        | 'checking'
        | 'error'
        | 'permission-denied'
        | 'permission-required'
        | 'service-disabled'
        | 'watching';
    }
  | { readonly gpsAvailable: boolean; readonly kind: 'simulated' };

export type PositionEvaluation =
  | {
      readonly ageMilliseconds: number;
      readonly kind: 'available';
      readonly origin: 'device' | 'simulated';
      readonly sample: PositionSample;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        | 'clock-invalid'
        | 'device-error'
        | 'gps-outage'
        | 'location-permission-denied'
        | 'location-permission-required'
        | 'location-service-disabled'
        | 'no-active-source'
        | 'no-sample'
        | 'sample-invalid'
        | 'stale-sample';
    };

const MAX_SAMPLE_AGE_MILLISECONDS = 3_000;
const MAX_CONTINUOUS_SIMULATION_TICK_MILLISECONDS = 5_000;
const MAX_ALTITUDE_FEET = 100_000;
const MIN_ALTITUDE_FEET = -4_000;
const MAX_GROUNDSPEED_KNOTS = 2_000;
const MAX_HORIZONTAL_ACCURACY_METRES = 1_000_000;

interface AdvanceSimulationInput {
  readonly altitudeFeet: number;
  readonly groundspeedKnots: number;
  readonly horizontalAccuracyMetres: number;
  readonly origin: Position;
  readonly previous: PositionSample | null;
  readonly sampledAt: number;
  readonly trackTrueDegrees: number;
}

export const advanceSimulationSample = ({
  altitudeFeet,
  groundspeedKnots,
  horizontalAccuracyMetres,
  origin,
  previous,
  sampledAt,
  trackTrueDegrees,
}: AdvanceSimulationInput): PositionSample => {
  if (
    !Number.isFinite(sampledAt) ||
    !Number.isFinite(altitudeFeet) ||
    altitudeFeet < MIN_ALTITUDE_FEET ||
    altitudeFeet > MAX_ALTITUDE_FEET ||
    !Number.isFinite(groundspeedKnots) ||
    groundspeedKnots < 0 ||
    groundspeedKnots > MAX_GROUNDSPEED_KNOTS ||
    !Number.isFinite(horizontalAccuracyMetres) ||
    horizontalAccuracyMetres < 0 ||
    horizontalAccuracyMetres > MAX_HORIZONTAL_ACCURACY_METRES
  ) {
    throw new RangeError('Simulation inputs are outside supported bounds');
  }
  const track = trueDegrees(trackTrueDegrees);
  if (previous === null) {
    return {
      altitudeFeet,
      groundspeedKnots,
      horizontalAccuracyMetres,
      latitude: origin.latitude,
      longitude: origin.longitude,
      sampledAt,
      trackDegrees: track,
      trackReference: 'true',
    };
  }
  const deltaMilliseconds = sampledAt - previous.sampledAt;
  if (!Number.isFinite(deltaMilliseconds) || deltaMilliseconds < 0) {
    throw new RangeError('Simulation clock moved backwards');
  }
  if (deltaMilliseconds === 0) return previous;
  const current = position(previous.latitude, previous.longitude);
  const next =
    deltaMilliseconds > MAX_CONTINUOUS_SIMULATION_TICK_MILLISECONDS
      ? current
      : destinationPoint(
          current,
          track,
          nauticalMiles((groundspeedKnots * deltaMilliseconds) / 3_600_000),
        );
  return {
    altitudeFeet,
    groundspeedKnots,
    horizontalAccuracyMetres,
    latitude: next.latitude,
    longitude: next.longitude,
    sampledAt,
    trackDegrees: track,
    trackReference: 'true',
  };
};

export interface DeviceLocationInput {
  readonly accuracyMetres: number | null;
  readonly altitudeMetres: number | null;
  readonly headingDegrees: number | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly speedMetresPerSecond: number | null;
  readonly timestamp: number;
}

const METRES_TO_FEET = 3.280_839_895;
const METRES_PER_SECOND_TO_KNOTS = 1.943_844_492;

export const mapDeviceLocation = (input: DeviceLocationInput): PositionSample => {
  const optionalNonNegative = (
    value: number | null,
    label: string,
    maximum: number,
  ): number | null => {
    if (value === null) return null;
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      throw new RangeError(`${label} is outside supported bounds`);
    }
    return value;
  };
  const coordinate = position(input.latitude, input.longitude);
  if (!Number.isFinite(input.timestamp))
    throw new RangeError('Location timestamp must be finite');
  const accuracy = optionalNonNegative(
    input.accuracyMetres,
    'Location accuracy',
    MAX_HORIZONTAL_ACCURACY_METRES,
  );
  const altitude = input.altitudeMetres;
  if (
    altitude !== null &&
    (!Number.isFinite(altitude) ||
      altitude < MIN_ALTITUDE_FEET / METRES_TO_FEET ||
      altitude > MAX_ALTITUDE_FEET / METRES_TO_FEET)
  ) {
    throw new RangeError('Location altitude is outside supported bounds');
  }
  const speed = optionalNonNegative(
    input.speedMetresPerSecond,
    'Location speed',
    MAX_GROUNDSPEED_KNOTS / METRES_PER_SECOND_TO_KNOTS,
  );
  const heading = input.headingDegrees;
  if (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading >= 360)) {
    throw new RangeError('Location heading must be within [0, 360)');
  }
  return {
    altitudeFeet: altitude === null ? null : altitude * METRES_TO_FEET,
    groundspeedKnots: speed === null ? null : speed * METRES_PER_SECOND_TO_KNOTS,
    horizontalAccuracyMetres: accuracy,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    sampledAt: input.timestamp,
    trackDegrees: heading,
    trackReference: 'platform',
  };
};

export const evaluatePosition = (
  scenario: PositionScenario,
  sample: PositionSample | null,
  now: number,
): PositionEvaluation => {
  if (scenario.kind === 'disabled') return { kind: 'unavailable', reason: 'no-active-source' };
  if (scenario.kind === 'simulated' && !scenario.gpsAvailable) {
    return { kind: 'unavailable', reason: 'gps-outage' };
  }
  if (scenario.kind === 'device' && scenario.status !== 'watching') {
    const reasons = {
      checking: 'no-sample',
      error: 'device-error',
      'permission-denied': 'location-permission-denied',
      'permission-required': 'location-permission-required',
      'service-disabled': 'location-service-disabled',
    } as const;
    return { kind: 'unavailable', reason: reasons[scenario.status] };
  }
  if (sample === null) return { kind: 'unavailable', reason: 'no-sample' };
  if (!Number.isFinite(now)) return { kind: 'unavailable', reason: 'clock-invalid' };
  if (
    !Number.isFinite(sample.sampledAt) ||
    !Number.isFinite(sample.latitude) ||
    sample.latitude < -90 ||
    sample.latitude > 90 ||
    !Number.isFinite(sample.longitude) ||
    sample.longitude < -180 ||
    sample.longitude > 180 ||
    (sample.altitudeFeet !== null &&
      (!Number.isFinite(sample.altitudeFeet) ||
        sample.altitudeFeet < MIN_ALTITUDE_FEET ||
        sample.altitudeFeet > MAX_ALTITUDE_FEET)) ||
    (sample.groundspeedKnots !== null &&
      (!Number.isFinite(sample.groundspeedKnots) ||
        sample.groundspeedKnots < 0 ||
        sample.groundspeedKnots > MAX_GROUNDSPEED_KNOTS)) ||
    (sample.horizontalAccuracyMetres !== null &&
      (!Number.isFinite(sample.horizontalAccuracyMetres) ||
        sample.horizontalAccuracyMetres < 0 ||
        sample.horizontalAccuracyMetres > MAX_HORIZONTAL_ACCURACY_METRES)) ||
    (sample.trackDegrees !== null &&
      (!Number.isFinite(sample.trackDegrees) ||
        sample.trackDegrees < 0 ||
        sample.trackDegrees >= 360))
  ) {
    return { kind: 'unavailable', reason: 'sample-invalid' };
  }
  const ageMilliseconds = now - sample.sampledAt;
  if (ageMilliseconds < 0) return { kind: 'unavailable', reason: 'clock-invalid' };
  if (ageMilliseconds > MAX_SAMPLE_AGE_MILLISECONDS) {
    return { kind: 'unavailable', reason: 'stale-sample' };
  }
  return { ageMilliseconds, kind: 'available', origin: scenario.kind, sample };
};
