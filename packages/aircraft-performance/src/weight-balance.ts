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

const MAXIMUM_LOADING_STATIONS = 100;
const MAXIMUM_MASS_KILOGRAMS = 100_000;
const MAXIMUM_ABSOLUTE_ARM_METRES = 100;
const hasSafeStationIdentifier = (value: string): boolean =>
  value.length > 0 &&
  value.length <= 80 &&
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127;
  });

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

const orientation = (start: EnvelopePoint, end: EnvelopePoint, point: EnvelopePoint): number =>
  (end.arm - start.arm) * (point.mass - start.mass) -
  (end.mass - start.mass) * (point.arm - start.arm);

const segmentsIntersect = (
  firstStart: EnvelopePoint,
  firstEnd: EnvelopePoint,
  secondStart: EnvelopePoint,
  secondEnd: EnvelopePoint,
): boolean => {
  const values = [
    orientation(firstStart, firstEnd, secondStart),
    orientation(firstStart, firstEnd, secondEnd),
    orientation(secondStart, secondEnd, firstStart),
    orientation(secondStart, secondEnd, firstEnd),
  ];
  const signs = values.map((value) => (Math.abs(value) <= 1e-9 ? 0 : Math.sign(value)));
  if (signs[0] !== signs[1] && signs[2] !== signs[3]) return true;
  return (
    (signs[0] === 0 && pointOnSegment(secondStart, firstStart, firstEnd)) ||
    (signs[1] === 0 && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (signs[2] === 0 && pointOnSegment(firstStart, secondStart, secondEnd)) ||
    (signs[3] === 0 && pointOnSegment(firstEnd, secondStart, secondEnd))
  );
};

export const assertValidCgEnvelope = (envelope: readonly EnvelopePoint[]): void => {
  if (envelope.length < 3 || envelope.length > 100) {
    throw new RangeError('A CG envelope requires 3 to 100 points');
  }
  const keys = new Set<string>();
  let twiceArea = 0;
  envelope.forEach((point, index) => {
    if (
      !Number.isFinite(point.arm) ||
      Math.abs(point.arm) > MAXIMUM_ABSOLUTE_ARM_METRES ||
      !Number.isFinite(point.mass) ||
      point.mass <= 0 ||
      point.mass > MAXIMUM_MASS_KILOGRAMS
    ) {
      throw new RangeError('CG envelope points are outside supported arm or mass bounds');
    }
    const key = `${point.arm}:${point.mass}`;
    if (keys.has(key)) throw new RangeError('CG envelope points must be unique');
    keys.add(key);
    const next = envelope[(index + 1) % envelope.length];
    if (next === undefined) throw new Error('CG envelope indexing invariant failed');
    twiceArea += point.arm * next.mass - next.arm * point.mass;
  });
  if (Math.abs(twiceArea) <= 1e-9) {
    throw new RangeError('CG envelope must enclose a non-zero area');
  }
  for (let first = 0; first < envelope.length; first += 1) {
    const firstEndIndex = (first + 1) % envelope.length;
    for (let second = first + 1; second < envelope.length; second += 1) {
      const secondEndIndex = (second + 1) % envelope.length;
      if (firstEndIndex === second || secondEndIndex === first) continue;
      const firstStart = envelope[first];
      const firstEnd = envelope[firstEndIndex];
      const secondStart = envelope[second];
      const secondEnd = envelope[secondEndIndex];
      if (
        firstStart === undefined ||
        firstEnd === undefined ||
        secondStart === undefined ||
        secondEnd === undefined
      ) {
        throw new Error('CG envelope indexing invariant failed');
      }
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        throw new RangeError('CG envelope edges must not intersect');
      }
    }
  }
};

export const calculateLoadingSummary = (input: LoadingSummaryInput): LoadingSummary => {
  if (
    !Number.isFinite(input.maximumMass) ||
    input.maximumMass <= 0 ||
    input.maximumMass > MAXIMUM_MASS_KILOGRAMS
  ) {
    throw new RangeError('Maximum mass must be finite and from above 0 through 100,000 KG');
  }
  if (input.stations.length > MAXIMUM_LOADING_STATIONS) {
    throw new RangeError('Loading scenario exceeds the supported station limit');
  }
  const ids = new Set<string>();
  const stations = input.stations.map((station): StationResult => {
    if (!hasSafeStationIdentifier(station.id)) {
      throw new RangeError('Station identifier is invalid');
    }
    if (ids.has(station.id))
      throw new RangeError(`Duplicate station identifier: ${station.id}`);
    if (
      !Number.isFinite(station.mass) ||
      station.mass < 0 ||
      station.mass > MAXIMUM_MASS_KILOGRAMS
    ) {
      throw new RangeError(`Station ${station.id} mass must be from 0 through 100,000 KG`);
    }
    if (!Number.isFinite(station.arm) || Math.abs(station.arm) > MAXIMUM_ABSOLUTE_ARM_METRES) {
      throw new RangeError(`Station ${station.id} arm must be from -100 through 100 M`);
    }
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
  assertValidCgEnvelope(input.envelope);
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
