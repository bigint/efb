export interface SimulationSample {
  readonly altitudeFeet: number;
  readonly groundspeedKnots: number;
  readonly horizontalAccuracyMetres: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly sampledAt: number;
  readonly trackTrueDegrees: null;
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
        'clock-invalid' | 'gps-outage' | 'no-active-source' | 'no-sample' | 'stale-sample';
    };

const MAX_SAMPLE_AGE_MILLISECONDS = 3_000;

export const evaluatePosition = (
  scenario: PositionScenario,
  sample: SimulationSample | null,
  now: number,
): PositionEvaluation => {
  if (scenario.kind === 'disabled') return { kind: 'unavailable', reason: 'no-active-source' };
  if (!scenario.gpsAvailable) return { kind: 'unavailable', reason: 'gps-outage' };
  if (sample === null) return { kind: 'unavailable', reason: 'no-sample' };
  const ageMilliseconds = now - sample.sampledAt;
  if (ageMilliseconds < 0) return { kind: 'unavailable', reason: 'clock-invalid' };
  if (ageMilliseconds > MAX_SAMPLE_AGE_MILLISECONDS) {
    return { kind: 'unavailable', reason: 'stale-sample' };
  }
  return { ageMilliseconds, kind: 'available', origin: 'simulated', sample };
};
