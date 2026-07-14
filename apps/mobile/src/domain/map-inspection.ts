import {
  greatCircleDistance,
  initialTrueBearing,
  position,
  type Position,
} from '@driftline/geospatial';

export interface InspectionAirport {
  readonly identifier: string;
  readonly position: Position;
}

export interface MapInspection {
  readonly latitude: number;
  readonly longitude: number;
  readonly nearest: {
    readonly bearingTrue: number | null;
    readonly distanceNauticalMiles: number;
    readonly identifier: string;
  } | null;
}

export const inspectMapPoint = (
  longitude: number,
  latitude: number,
  airports: readonly InspectionAirport[],
): MapInspection => {
  const inspected = position(latitude, longitude);
  if (airports.length > 1_000) throw new Error('Inspection airport collection exceeds limits');
  const identifiers = new Set<string>();
  let nearest: MapInspection['nearest'] = null;
  for (const airport of airports) {
    if (!/^[A-Z0-9-]{1,16}$/u.test(airport.identifier) || identifiers.has(airport.identifier)) {
      throw new Error('Inspection airports require unique normalized identifiers');
    }
    identifiers.add(airport.identifier);
    const distanceNauticalMiles = greatCircleDistance(inspected, airport.position);
    if (nearest === null || distanceNauticalMiles < nearest.distanceNauticalMiles) {
      nearest = {
        bearingTrue:
          distanceNauticalMiles === 0 ? null : initialTrueBearing(inspected, airport.position),
        distanceNauticalMiles,
        identifier: airport.identifier,
      };
    }
  }
  return { latitude: inspected.latitude, longitude: inspected.longitude, nearest };
};
