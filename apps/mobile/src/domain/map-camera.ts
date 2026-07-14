import type { PositionEvaluation } from './position-source';

export type MapOrientationMode = 'north-up' | 'track-up';

export type ResolvedMapCamera =
  | { readonly bearing: 0; readonly kind: 'north-up' }
  | {
      readonly bearing: 0;
      readonly kind: 'track-up-unavailable';
      readonly reason: 'course-unavailable' | 'position-unavailable';
    }
  | {
      readonly bearing: number;
      readonly center: [number, number];
      readonly kind: 'track-up';
      readonly reference: 'platform' | 'true';
    };

export const resolveMapCamera = (
  mode: MapOrientationMode,
  position: PositionEvaluation,
): ResolvedMapCamera => {
  if (mode === 'north-up') return { bearing: 0, kind: 'north-up' };
  if (position.kind !== 'available') {
    return { bearing: 0, kind: 'track-up-unavailable', reason: 'position-unavailable' };
  }
  if (position.sample.trackDegrees === null) {
    return { bearing: 0, kind: 'track-up-unavailable', reason: 'course-unavailable' };
  }
  return {
    bearing: position.sample.trackDegrees,
    center: [position.sample.longitude, position.sample.latitude],
    kind: 'track-up',
    reference: position.sample.trackReference,
  };
};
