import {
  nauticalMiles,
  type Knots,
  type NauticalMiles,
  type TrueDegrees,
} from '@driftline/data-contracts';
import { greatCircleDistance, initialTrueBearing, type Position } from '@driftline/geospatial';

export interface RouteWaypoint {
  readonly identifier: string;
  readonly position: Position;
}

export interface RouteLeg {
  readonly distance: NauticalMiles;
  readonly from: RouteWaypoint;
  readonly initialTrueCourse: TrueDegrees;
  readonly to: RouteWaypoint;
}

export interface RouteSummary {
  readonly estimatedMinutes: number | null;
  readonly legs: readonly RouteLeg[];
  readonly status: 'empty' | 'incomplete' | 'ready';
  readonly totalDistance: NauticalMiles | null;
}

export type RouteResolution =
  | { readonly status: 'resolved'; readonly waypoints: readonly RouteWaypoint[] }
  | { readonly status: 'unresolved'; readonly unresolvedIdentifiers: readonly string[] };

const MAXIMUM_ROUTE_WAYPOINTS = 100;
const waypointIdentifierPattern = /^[A-Z0-9-]{1,16}$/u;

const requireWaypointIdentifier = (identifier: string): void => {
  if (!waypointIdentifierPattern.test(identifier)) {
    throw new RangeError('Waypoint identifier is invalid');
  }
};

export const resolveRouteIdentifiers = (
  identifiers: readonly string[],
  available: readonly RouteWaypoint[],
): RouteResolution => {
  if (identifiers.length > MAXIMUM_ROUTE_WAYPOINTS) {
    throw new RangeError('Route exceeds the supported waypoint limit');
  }
  const requested = new Set<string>();
  for (const identifier of identifiers) {
    requireWaypointIdentifier(identifier);
    if (requested.has(identifier))
      throw new RangeError('Route waypoint identifiers are ambiguous');
    requested.add(identifier);
  }
  const byIdentifier = new Map<string, RouteWaypoint>();
  for (const waypoint of available) {
    requireWaypointIdentifier(waypoint.identifier);
    if (byIdentifier.has(waypoint.identifier)) {
      throw new RangeError('Available waypoint identifiers are ambiguous');
    }
    byIdentifier.set(waypoint.identifier, waypoint);
  }
  const unresolvedIdentifiers = identifiers.filter(
    (identifier) => !byIdentifier.has(identifier),
  );
  if (unresolvedIdentifiers.length > 0) return { status: 'unresolved', unresolvedIdentifiers };
  return {
    status: 'resolved',
    waypoints: identifiers.map((identifier) => {
      const waypoint = byIdentifier.get(identifier);
      if (waypoint === undefined) throw new Error('Route resolution invariant failed');
      return waypoint;
    }),
  };
};

export const calculateRoute = (
  waypoints: readonly RouteWaypoint[],
  cruiseGroundspeed: Knots | null,
): RouteSummary => {
  if (waypoints.length > MAXIMUM_ROUTE_WAYPOINTS) {
    throw new RangeError('Route exceeds the supported waypoint limit');
  }
  const identifiers = new Set<string>();
  for (const waypoint of waypoints) {
    requireWaypointIdentifier(waypoint.identifier);
    if (identifiers.has(waypoint.identifier))
      throw new RangeError('Duplicate waypoint identifiers are ambiguous');
    identifiers.add(waypoint.identifier);
  }

  if (waypoints.length < 2) {
    return {
      estimatedMinutes: null,
      legs: [],
      status: waypoints.length === 0 ? 'empty' : 'incomplete',
      totalDistance: null,
    };
  }

  const legs: RouteLeg[] = [];
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1];
    const to = waypoints[index];
    if (from === undefined || to === undefined)
      throw new Error('Route indexing invariant failed');
    legs.push({
      distance: greatCircleDistance(from.position, to.position),
      from,
      initialTrueCourse: initialTrueBearing(from.position, to.position),
      to,
    });
  }
  const totalDistance = nauticalMiles(legs.reduce((sum, leg) => sum + leg.distance, 0));
  const estimatedMinutes =
    cruiseGroundspeed === null
      ? null
      : !Number.isFinite(cruiseGroundspeed) || cruiseGroundspeed <= 0
        ? (() => {
            throw new RangeError('Cruise groundspeed must be positive');
          })()
        : (totalDistance / cruiseGroundspeed) * 60;
  return { estimatedMinutes, legs, status: 'ready', totalDistance };
};
