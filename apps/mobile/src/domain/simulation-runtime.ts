import type { Position } from '@driftline/geospatial';

import {
  advanceSimulationSample,
  holdSimulationSample,
  type PositionSample,
  type PositionScenario,
} from './position-source';
import { simulationProfileSchema, type SimulationProfile } from './simulation-profile';

export interface SimulationOrigin {
  readonly identifier: string;
  readonly position: Position;
}

export interface SimulationTickInput {
  readonly origins: readonly SimulationOrigin[];
  readonly paused: boolean;
  readonly positionSample: PositionSample | null;
  readonly positionScenario: PositionScenario;
  readonly profile: SimulationProfile;
  readonly sampledAt: number;
}

export interface SimulationTickOutput {
  readonly positionSample: PositionSample | null;
  readonly positionScenario: PositionScenario;
}

export const reduceSimulationTick = (input: SimulationTickInput): SimulationTickOutput => {
  if (input.positionScenario.kind !== 'simulated') {
    return {
      positionSample: input.positionSample,
      positionScenario: input.positionScenario,
    };
  }
  if (!input.positionScenario.gpsAvailable) {
    return { positionSample: null, positionScenario: input.positionScenario };
  }
  if (!Number.isFinite(input.sampledAt)) {
    return {
      positionSample: null,
      positionScenario: { gpsAvailable: false, kind: 'simulated' },
    };
  }
  try {
    const profile = simulationProfileSchema.parse(input.profile);
    const origin = input.origins.find(
      ({ identifier }) => identifier === profile.startingAirportIdentifier,
    )?.position;
    if (origin === undefined) throw new Error('Simulation starting airport is unavailable');
    return {
      positionSample:
        input.paused && input.positionSample !== null
          ? holdSimulationSample(input.positionSample, input.sampledAt)
          : advanceSimulationSample({
              altitudeFeet: profile.altitudeFeet,
              groundspeedKnots: profile.groundspeedKnots,
              horizontalAccuracyMetres: profile.horizontalAccuracyMetres,
              origin,
              previous: input.positionSample,
              sampledAt: input.sampledAt,
              trackTrueDegrees: profile.trackTrueDegrees,
              verticalSpeedFeetPerMinute: profile.verticalSpeedFeetPerMinute,
            }),
      positionScenario: input.positionScenario,
    };
  } catch {
    return {
      positionSample: null,
      positionScenario: { gpsAvailable: false, kind: 'simulated' },
    };
  }
};
