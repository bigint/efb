import {
  knots,
  nauticalMiles,
  type NauticalMiles,
  type TrueDegrees,
} from '@driftline/data-contracts';
import {
  greatCircleDistance,
  initialTrueBearing,
  trackOffset,
  type Position,
} from '@driftline/geospatial';

import { calculateRoute, type RouteWaypoint } from './route';

export type ActiveLegNavigation =
  | {
      readonly reason: 'invalid-active-leg' | 'no-active-leg' | 'route-incomplete';
      readonly status: 'unavailable';
    }
  | {
      readonly activeLegIndex: number;
      readonly crossTrack: NauticalMiles;
      readonly distanceToNext: NauticalMiles;
      readonly estimatedMinutesRemaining: number | null;
      readonly estimatedMinutesToNext: number | null;
      readonly nextIdentifier: string;
      readonly routeRemaining: NauticalMiles;
      readonly status: 'ready';
      readonly trueBearingToNext: TrueDegrees | null;
    };

export const calculateActiveLegNavigation = ({
  activeLegIndex,
  current,
  groundspeedKnots,
  waypoints,
}: {
  readonly activeLegIndex: number | null;
  readonly current: Position;
  readonly groundspeedKnots: number | null;
  readonly waypoints: readonly RouteWaypoint[];
}): ActiveLegNavigation => {
  const route = calculateRoute(waypoints, null);
  if (route.status !== 'ready') return { reason: 'route-incomplete', status: 'unavailable' };
  if (activeLegIndex === null) return { reason: 'no-active-leg', status: 'unavailable' };
  if (
    !Number.isInteger(activeLegIndex) ||
    activeLegIndex < 0 ||
    activeLegIndex >= route.legs.length
  ) {
    return { reason: 'invalid-active-leg', status: 'unavailable' };
  }
  const leg = route.legs[activeLegIndex];
  if (leg === undefined) return { reason: 'invalid-active-leg', status: 'unavailable' };
  const distanceToNext = greatCircleDistance(current, leg.to.position);
  const trueBearingToNext =
    distanceToNext === 0 ? null : initialTrueBearing(current, leg.to.position);
  const crossTrack = trackOffset(leg.from.position, leg.to.position, current).crossTrack;
  const laterDistance = route.legs
    .slice(activeLegIndex + 1)
    .reduce((total, laterLeg) => total + laterLeg.distance, 0);
  const routeRemaining = nauticalMiles(distanceToNext + laterDistance);
  const validGroundspeed =
    groundspeedKnots !== null && Number.isFinite(groundspeedKnots) && groundspeedKnots > 0
      ? knots(groundspeedKnots)
      : null;
  return {
    activeLegIndex,
    crossTrack,
    distanceToNext,
    estimatedMinutesRemaining:
      validGroundspeed === null ? null : (routeRemaining / validGroundspeed) * 60,
    estimatedMinutesToNext:
      validGroundspeed === null ? null : (distanceToNext / validGroundspeed) * 60,
    nextIdentifier: leg.to.identifier,
    routeRemaining,
    status: 'ready',
    trueBearingToNext,
  };
};
