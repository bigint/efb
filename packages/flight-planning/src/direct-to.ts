import { knots, type NauticalMiles, type TrueDegrees } from '@driftline/data-contracts';
import { greatCircleDistance, initialTrueBearing, type Position } from '@driftline/geospatial';

export interface DirectToNavigation {
  readonly distance: NauticalMiles;
  readonly estimatedMinutes: number | null;
  readonly targetIdentifier: string;
  readonly trueBearing: TrueDegrees | null;
}

export const calculateDirectToNavigation = ({
  current,
  groundspeedKnots,
  target,
}: {
  readonly current: Position;
  readonly groundspeedKnots: number | null;
  readonly target: { readonly identifier: string; readonly position: Position };
}): DirectToNavigation => {
  if (!/^[A-Z0-9-]{1,16}$/u.test(target.identifier)) {
    throw new Error('Direct-to target identifier is invalid');
  }
  const distance = greatCircleDistance(current, target.position);
  const validGroundspeed =
    groundspeedKnots !== null && Number.isFinite(groundspeedKnots) && groundspeedKnots > 0
      ? knots(groundspeedKnots)
      : null;
  return {
    distance,
    estimatedMinutes: validGroundspeed === null ? null : (distance / validGroundspeed) * 60,
    targetIdentifier: target.identifier,
    trueBearing: distance === 0 ? null : initialTrueBearing(current, target.position),
  };
};
