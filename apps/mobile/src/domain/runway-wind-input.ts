import { knots, trueDegrees, type Knots, type TrueDegrees } from '@driftline/data-contracts';

export type RunwayWindInput =
  | {
      readonly directionTrue: TrueDegrees;
      readonly gustSpeed: Knots | null;
      readonly kind: 'ready';
      readonly steadySpeed: Knots;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        | 'direction-invalid'
        | 'gust-below-steady'
        | 'gust-invalid'
        | 'missing-input'
        | 'speed-invalid';
    };

export const parseRunwayWindInput = (
  direction: string,
  steadySpeed: string,
  gustSpeed: string,
): RunwayWindInput => {
  if (direction.trim().length === 0 || steadySpeed.trim().length === 0) {
    return { kind: 'unavailable', reason: 'missing-input' };
  }
  const directionValue = Number(direction);
  if (!Number.isFinite(directionValue) || directionValue < 0 || directionValue >= 360) {
    return { kind: 'unavailable', reason: 'direction-invalid' };
  }
  const steadyValue = Number(steadySpeed);
  if (!Number.isFinite(steadyValue) || steadyValue < 0 || steadyValue > 300) {
    return { kind: 'unavailable', reason: 'speed-invalid' };
  }
  const gustValue = gustSpeed.trim().length === 0 ? null : Number(gustSpeed);
  if (gustValue !== null && (!Number.isFinite(gustValue) || gustValue < 0 || gustValue > 300)) {
    return { kind: 'unavailable', reason: 'gust-invalid' };
  }
  if (gustValue !== null && gustValue < steadyValue) {
    return { kind: 'unavailable', reason: 'gust-below-steady' };
  }
  return {
    directionTrue: trueDegrees(directionValue),
    gustSpeed: gustValue === null ? null : knots(gustValue),
    kind: 'ready',
    steadySpeed: knots(steadyValue),
  };
};
