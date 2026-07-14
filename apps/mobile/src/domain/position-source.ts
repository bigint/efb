import { nauticalMiles, trueDegrees } from '@driftline/data-contracts';
import { destinationPoint, position, type Position } from '@driftline/geospatial';

export interface SimulationSample {
  readonly altitudeFeet: number;
  readonly groundspeedKnots: number;
  readonly horizontalAccuracyMetres: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly sampledAt: number;
  readonly trackTrueDegrees: number | null;
}

export type PositionScenario =
  | { readonly kind: 'disabled' }
  | { readonly gpsAvailable: boolean; readonly kind: 'simulated' };

export type PositionEvaluation =
  | {
      readonly ageMilliseconds: number;
      readonly kind: 'available';
      readonly origin: 'simulated';
      readonly sample: SimulationSample;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        | 'clock-invalid'
        | 'gps-outage'
        | 'no-active-source'
        | 'no-sample'
        | 'sample-invalid'
        | 'stale-sample';
    };

const MAX_SAMPLE_AGE_MILLISECONDS = 3_000;
const MAX_CONTINUOUS_SIMULATION_TICK_MILLISECONDS = 5_000;

interface AdvanceSimulationInput {
  readonly altitudeFeet: number;
  readonly groundspeedKnots: number;
  readonly horizontalAccuracyMetres: number;
  readonly origin: Position;
  readonly previous: SimulationSample | null;
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
}: AdvanceSimulationInput): SimulationSample => {
  if (
    !Number.isFinite(sampledAt) ||
    !Number.isFinite(altitudeFeet) ||
    !Number.isFinite(groundspeedKnots) ||
    groundspeedKnots < 0 ||
    !Number.isFinite(horizontalAccuracyMetres) ||
    horizontalAccuracyMetres < 0
  ) {
    throw new RangeError('Simulation inputs must be finite and non-negative where required');
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
      trackTrueDegrees: track,
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
    trackTrueDegrees: track,
  };
};

export const evaluatePosition = (
  scenario: PositionScenario,
  sample: SimulationSample | null,
  now: number,
): PositionEvaluation => {
  if (scenario.kind === 'disabled') return { kind: 'unavailable', reason: 'no-active-source' };
  if (!scenario.gpsAvailable) return { kind: 'unavailable', reason: 'gps-outage' };
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
    !Number.isFinite(sample.altitudeFeet) ||
    !Number.isFinite(sample.groundspeedKnots) ||
    sample.groundspeedKnots < 0 ||
    !Number.isFinite(sample.horizontalAccuracyMetres) ||
    sample.horizontalAccuracyMetres < 0 ||
    (sample.trackTrueDegrees !== null &&
      (!Number.isFinite(sample.trackTrueDegrees) ||
        sample.trackTrueDegrees < 0 ||
        sample.trackTrueDegrees >= 360))
  ) {
    return { kind: 'unavailable', reason: 'sample-invalid' };
  }
  const ageMilliseconds = now - sample.sampledAt;
  if (ageMilliseconds < 0) return { kind: 'unavailable', reason: 'clock-invalid' };
  if (ageMilliseconds > MAX_SAMPLE_AGE_MILLISECONDS) {
    return { kind: 'unavailable', reason: 'stale-sample' };
  }
  return { ageMilliseconds, kind: 'available', origin: 'simulated', sample };
};
