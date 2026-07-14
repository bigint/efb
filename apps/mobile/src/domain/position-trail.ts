import { position } from '@driftline/geospatial';

import type { PositionSample } from './position-source';

export interface PositionTrailPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly origin: 'device' | 'simulated';
  readonly sampledAt: number;
}

const assertValidPositionTrail = (trail: readonly PositionTrailPoint[]): void => {
  if (trail.length > 600) throw new RangeError('Position trail exceeds the supported limit');
  let previous: PositionTrailPoint | undefined;
  for (const point of trail) {
    const origin: unknown = point.origin;
    position(point.latitude, point.longitude);
    if (
      !Number.isFinite(point.sampledAt) ||
      point.sampledAt < 0 ||
      (origin !== 'device' && origin !== 'simulated') ||
      (previous !== undefined &&
        (point.origin !== previous.origin || point.sampledAt <= previous.sampledAt))
    ) {
      throw new RangeError('Position trail contains invalid or unordered points');
    }
    previous = point;
  }
};

export const appendPositionTrail = (
  current: readonly PositionTrailPoint[],
  origin: PositionTrailPoint['origin'],
  sample: PositionSample,
  limit = 120,
): readonly PositionTrailPoint[] => {
  if (!Number.isInteger(limit) || limit < 2 || limit > 600) {
    throw new RangeError('Position trail limit must be an integer from 2 through 600');
  }
  assertValidPositionTrail(current);
  const runtimeOrigin: unknown = origin;
  if (runtimeOrigin !== 'device' && runtimeOrigin !== 'simulated') {
    throw new RangeError('Position trail origin is invalid');
  }
  const coordinate = position(sample.latitude, sample.longitude);
  if (!Number.isFinite(sample.sampledAt) || sample.sampledAt < 0)
    throw new RangeError('Trail sample time must be finite and non-negative');
  const point: PositionTrailPoint = {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    origin,
    sampledAt: sample.sampledAt,
  };
  const previous = current.at(-1);
  if (previous === undefined) return [point];
  if (
    previous.origin !== origin ||
    sample.sampledAt < previous.sampledAt ||
    (sample.sampledAt === previous.sampledAt &&
      (coordinate.latitude !== previous.latitude ||
        coordinate.longitude !== previous.longitude))
  ) {
    return [point];
  }
  if (sample.sampledAt === previous.sampledAt) return current;
  if (
    coordinate.latitude === previous.latitude &&
    coordinate.longitude === previous.longitude
  ) {
    return [...current.slice(0, -1), point];
  }
  return [...current, point].slice(-limit);
};

export const buildPositionTrailGeometry = (
  trail: readonly PositionTrailPoint[],
): {
  coordinates: [number, number][][];
  type: 'MultiLineString';
} => {
  assertValidPositionTrail(trail);
  if (trail.length < 2) return { coordinates: [], type: 'MultiLineString' };
  const lines: [number, number][][] = [];
  let current: [number, number][] = [[trail[0]?.longitude ?? 0, trail[0]?.latitude ?? 0]];
  for (const point of trail.slice(1)) {
    const previous = current.at(-1);
    if (previous === undefined) throw new Error('Position trail segment invariant failed');
    const next: [number, number] = [point.longitude, point.latitude];
    const delta = next[0] - previous[0];
    if (Math.abs(delta) <= 180) {
      current.push(next);
      continue;
    }
    const eastbound = previous[0] > 0 && next[0] < 0;
    const previousBoundary = eastbound ? 180 : -180;
    const nextBoundary = eastbound ? -180 : 180;
    const unwrapped = next[0] + (eastbound ? 360 : -360);
    const fraction = (previousBoundary - previous[0]) / (unwrapped - previous[0]);
    const boundaryLatitude = previous[1] + fraction * (next[1] - previous[1]);
    current.push([previousBoundary, boundaryLatitude]);
    lines.push(current);
    current = [[nextBoundary, boundaryLatitude], next];
  }
  lines.push(current);
  return { coordinates: lines.filter((line) => line.length >= 2), type: 'MultiLineString' };
};
