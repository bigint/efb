import type { Knots, NauticalMiles, TrueDegrees } from '@driftline/data-contracts';

import { calculateRoute, type RouteLeg, type RouteWaypoint } from './route';
import { solveWindTriangle, type WindTriangleResult } from './wind-triangle';

export interface WindAdjustedLeg extends RouteLeg {
  readonly wind: Extract<WindTriangleResult, { readonly status: 'solved' }>;
}

export type WindAdjustedRoute =
  | {
      readonly estimatedMinutes: null;
      readonly legs: readonly [];
      readonly status: 'empty' | 'incomplete';
      readonly totalDistance: null;
    }
  | {
      readonly failedLeg: RouteLeg;
      readonly legs: readonly WindAdjustedLeg[];
      readonly reason: Extract<
        WindTriangleResult,
        { readonly status: 'no-solution' }
      >['reason'];
      readonly status: 'no-solution';
      readonly totalDistance: NauticalMiles;
    }
  | {
      readonly estimatedMinutes: number;
      readonly legs: readonly WindAdjustedLeg[];
      readonly status: 'ready';
      readonly totalDistance: NauticalMiles;
    };

export const calculateWindAdjustedRoute = ({
  trueAirspeed,
  waypoints,
  windFromTrue,
  windSpeed,
}: {
  readonly trueAirspeed: Knots;
  readonly waypoints: readonly RouteWaypoint[];
  readonly windFromTrue: TrueDegrees;
  readonly windSpeed: Knots;
}): WindAdjustedRoute => {
  const route = calculateRoute(waypoints, null);
  if (route.status !== 'ready') {
    return {
      estimatedMinutes: null,
      legs: [],
      status: route.status,
      totalDistance: null,
    };
  }
  if (route.totalDistance === null) throw new Error('Ready route distance invariant failed');
  const legs: WindAdjustedLeg[] = [];
  let estimatedMinutes = 0;
  for (const leg of route.legs) {
    const wind = solveWindTriangle({
      desiredCourseTrue: leg.initialTrueCourse,
      trueAirspeed,
      windFromTrue,
      windSpeed,
    });
    if (wind.status === 'no-solution') {
      return {
        failedLeg: leg,
        legs,
        reason: wind.reason,
        status: 'no-solution',
        totalDistance: route.totalDistance,
      };
    }
    legs.push({ ...leg, wind });
    estimatedMinutes += (leg.distance / wind.groundspeed) * 60;
  }
  return {
    estimatedMinutes,
    legs,
    status: 'ready',
    totalDistance: route.totalDistance,
  };
};
