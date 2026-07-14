import { kilograms, metres, type Kilograms, type Metres } from '@driftline/data-contracts';

declare const momentBrand: unique symbol;
export type KilogramMetres = number & { readonly [momentBrand]: 'kilogram-metres' };

export interface LoadingStation {
  readonly arm: Metres;
  readonly id: string;
  readonly mass: Kilograms;
}

export interface EnvelopePoint {
  readonly arm: Metres;
  readonly mass: Kilograms;
}

export interface WeightBalanceInput {
  readonly envelope: readonly EnvelopePoint[];
  readonly maximumMass: Kilograms;
  readonly stations: readonly LoadingStation[];
}

export interface LoadingSummaryInput {
  readonly maximumMass: Kilograms;
  readonly stations: readonly LoadingStation[];
}

export interface StationResult extends LoadingStation {
  readonly moment: KilogramMetres;
}

export interface WeightBalanceResult {
  readonly centreOfGravityArm: Metres;
  readonly insideEnvelope: boolean;
  readonly massWithinLimit: boolean;
  readonly stations: readonly StationResult[];
  readonly totalMass: Kilograms;
  readonly totalMoment: KilogramMetres;
  readonly violations: readonly ('above-maximum-mass' | 'outside-envelope')[];
}

export interface LoadingSummary {
  readonly centreOfGravityArm: Metres;
  readonly massWithinLimit: boolean;
  readonly stations: readonly StationResult[];
  readonly totalMass: Kilograms;
  readonly totalMoment: KilogramMetres;
}

const kilogramMetres = (value: number): KilogramMetres => {
  if (!Number.isFinite(value)) throw new RangeError('Moment must be finite');
  return value as KilogramMetres;
};

const pointOnSegment = (
  point: EnvelopePoint,
  start: EnvelopePoint,
  end: EnvelopePoint,
): boolean => {
  const cross =
    (point.mass - start.mass) * (end.arm - start.arm) -
    (point.arm - start.arm) * (end.mass - start.mass);
  if (Math.abs(cross) > 1e-9) return false;
  return (
    point.arm >= Math.min(start.arm, end.arm) &&
    point.arm <= Math.max(start.arm, end.arm) &&
    point.mass >= Math.min(start.mass, end.mass) &&
    point.mass <= Math.max(start.mass, end.mass)
  );
};

const pointInEnvelope = (point: EnvelopePoint, envelope: readonly EnvelopePoint[]): boolean => {
  let inside = false;
  for (
    let index = 0, previous = envelope.length - 1;
    index < envelope.length;
    previous = index++
  ) {
    const start = envelope[index];
    const end = envelope[previous];
    if (start === undefined || end === undefined)
      throw new Error('Envelope indexing invariant failed');
    if (pointOnSegment(point, start, end)) return true;
    const crossesMass = start.mass > point.mass !== end.mass > point.mass;
    const intersectionArm =
      ((end.arm - start.arm) * (point.mass - start.mass)) / (end.mass - start.mass) + start.arm;
    if (crossesMass && point.arm < intersectionArm) inside = !inside;
  }
  return inside;
};

export const calculateLoadingSummary = (input: LoadingSummaryInput): LoadingSummary => {
  if (input.maximumMass <= 0) throw new RangeError('Maximum mass must be positive');
  const ids = new Set<string>();
  const stations = input.stations.map((station): StationResult => {
    if (station.id.trim().length === 0) throw new RangeError('Station identifier is required');
    if (ids.has(station.id))
      throw new RangeError(`Duplicate station identifier: ${station.id}`);
    if (station.mass < 0) throw new RangeError(`Station ${station.id} mass cannot be negative`);
    ids.add(station.id);
    return { ...station, moment: kilogramMetres(station.mass * station.arm) };
  });
  const totalMass = kilograms(stations.reduce((sum, station) => sum + station.mass, 0));
  if (totalMass <= 0) throw new RangeError('Total mass must be positive');
  const totalMoment = kilogramMetres(
    stations.reduce((sum, station) => sum + station.moment, 0),
  );
  const centreOfGravityArm = metres(totalMoment / totalMass);
  const massWithinLimit = totalMass <= input.maximumMass;
  return {
    centreOfGravityArm,
    massWithinLimit,
    stations,
    totalMass,
    totalMoment,
  };
};

export const calculateWeightBalance = (input: WeightBalanceInput): WeightBalanceResult => {
  if (input.envelope.length < 3)
    throw new RangeError('A CG envelope requires at least three points');
  const summary = calculateLoadingSummary(input);
  const insideEnvelope = pointInEnvelope(
    { arm: summary.centreOfGravityArm, mass: summary.totalMass },
    input.envelope,
  );
  const violations: WeightBalanceResult['violations'][number][] = [];
  if (!summary.massWithinLimit) violations.push('above-maximum-mass');
  if (!insideEnvelope) violations.push('outside-envelope');
  return {
    ...summary,
    insideEnvelope,
    violations,
  };
};
