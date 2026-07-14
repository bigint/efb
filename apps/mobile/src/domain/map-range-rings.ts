import { nauticalMiles, trueDegrees } from '@driftline/data-contracts';
import { destinationPoint, type Position } from '@driftline/geospatial';

export interface MapRangeRingFeature {
  geometry: {
    coordinates: [number, number][][];
    type: 'MultiLineString';
  };
  properties: { radiusNauticalMiles: number };
  type: 'Feature';
}

export interface MapRangeRingCollection {
  features: MapRangeRingFeature[];
  type: 'FeatureCollection';
}

const splitAtAntimeridian = (
  coordinates: readonly (readonly [number, number])[],
): [number, number][][] => {
  const first = coordinates[0];
  if (first === undefined) return [];
  const lines: [number, number][][] = [];
  let current: [number, number][] = [[...first]];

  for (const coordinate of coordinates.slice(1)) {
    const previous = current.at(-1);
    if (previous === undefined) throw new Error('Range-ring segment invariant failed');
    const longitudeDelta = coordinate[0] - previous[0];
    if (Math.abs(longitudeDelta) <= 180) {
      current.push([...coordinate]);
      continue;
    }

    const eastbound = previous[0] > 0 && coordinate[0] < 0;
    const previousBoundary = eastbound ? 180 : -180;
    const nextBoundary = eastbound ? -180 : 180;
    const unwrappedLongitude = coordinate[0] + (eastbound ? 360 : -360);
    const fraction = (previousBoundary - previous[0]) / (unwrappedLongitude - previous[0]);
    const boundaryLatitude = previous[1] + fraction * (coordinate[1] - previous[1]);
    current.push([previousBoundary, boundaryLatitude]);
    lines.push(current);
    current = [[nextBoundary, boundaryLatitude], [...coordinate]];
  }
  lines.push(current);
  return lines.filter((line) => line.length >= 2);
};

export const buildMapRangeRings = (
  center: Position,
  radiiNauticalMiles: readonly number[],
  segmentCount = 72,
): MapRangeRingCollection => {
  if (!Number.isInteger(segmentCount) || segmentCount < 12 || segmentCount > 360) {
    throw new RangeError('Range-ring segment count must be an integer from 12 through 360');
  }
  if (
    radiiNauticalMiles.length === 0 ||
    radiiNauticalMiles.length > 8 ||
    radiiNauticalMiles.some((radius) => !Number.isFinite(radius) || radius <= 0 || radius > 500)
  ) {
    throw new RangeError('Range rings require one through eight radii from 0 through 500 NM');
  }

  return {
    features: radiiNauticalMiles.map((radius) => {
      const coordinates = Array.from({ length: segmentCount + 1 }, (_, index) => {
        const point = destinationPoint(
          center,
          trueDegrees(((index * 360) / segmentCount) % 360),
          nauticalMiles(radius),
        );
        return [point.longitude, point.latitude] as const;
      });
      return {
        geometry: {
          coordinates: splitAtAntimeridian(coordinates),
          type: 'MultiLineString' as const,
        },
        properties: { radiusNauticalMiles: radius },
        type: 'Feature' as const,
      };
    }),
    type: 'FeatureCollection',
  };
};
