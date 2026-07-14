import {
  greatCircleDistance,
  initialTrueBearing,
  position,
  type Position,
} from '@driftline/geospatial';

export type MapMeasurementPoints =
  readonly [] | readonly [Position] | readonly [Position, Position];

export const appendMapMeasurementPoint = (
  current: MapMeasurementPoints,
  longitude: number,
  latitude: number,
): MapMeasurementPoints => {
  const next = position(latitude, longitude);
  if (current.length === 0) return [next];
  if (current.length === 1) return [current[0], next];
  return [next];
};

export type MapMeasurement =
  | { readonly kind: 'incomplete'; readonly points: 0 | 1 }
  | {
      readonly initialTrueBearing: number | null;
      readonly kind: 'ready';
      readonly nauticalMiles: number;
    };

export const calculateMapMeasurement = (points: MapMeasurementPoints): MapMeasurement => {
  if (points.length === 0) return { kind: 'incomplete', points: 0 };
  if (points.length === 1) return { kind: 'incomplete', points: 1 };
  const [start, end] = points;
  const nauticalMiles = greatCircleDistance(start, end);
  return {
    initialTrueBearing: nauticalMiles === 0 ? null : initialTrueBearing(start, end),
    kind: 'ready',
    nauticalMiles,
  };
};
