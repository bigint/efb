import {
  greatCircleDistance,
  initialTrueBearing,
  position,
  type Position,
} from '@driftline/geospatial';

import type { PositionEvaluation } from './position-source';

export interface RelativePosition {
  readonly accuracyMetres: number | null;
  readonly ageMilliseconds: number;
  readonly bearingTrue: number | null;
  readonly distanceNauticalMiles: number;
  readonly origin: 'device' | 'simulated';
}

export const calculateRelativePosition = (
  evaluation: PositionEvaluation,
  destination: Position,
): RelativePosition | null => {
  if (evaluation.kind !== 'available') return null;
  const from = position(evaluation.sample.latitude, evaluation.sample.longitude);
  const distance = greatCircleDistance(from, destination);
  return {
    accuracyMetres: evaluation.sample.horizontalAccuracyMetres,
    ageMilliseconds: evaluation.ageMilliseconds,
    bearingTrue: distance === 0 ? null : initialTrueBearing(from, destination),
    distanceNauticalMiles: distance,
    origin: evaluation.origin,
  };
};
