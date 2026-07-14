import type { MetarObservation } from './metar';

export type UsFlightCategory =
  | {
      readonly category: 'IFR' | 'LIFR' | 'MVFR' | 'VFR';
      readonly ceilingFeetAgl: number | null;
      readonly kind: 'classified';
      readonly limitingFactor: 'both' | 'ceiling' | 'visibility';
      readonly visibilityBound: 'exact' | 'greater-than' | 'less-than';
      readonly visibilityStatuteMiles: number;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: 'ceiling-unknown' | 'visibility-bound-ambiguous' | 'visibility-unknown';
    };

const categoryRank = { IFR: 2, LIFR: 3, MVFR: 1, VFR: 0 } as const;
type Category = keyof typeof categoryRank;

const ceilingCategory = (feet: number | null): Category =>
  feet === null
    ? 'VFR'
    : feet < 500
      ? 'LIFR'
      : feet < 1_000
        ? 'IFR'
        : feet <= 3_000
          ? 'MVFR'
          : 'VFR';

const visibilityCategory = (statuteMiles: number): Category =>
  statuteMiles < 1 ? 'LIFR' : statuteMiles < 3 ? 'IFR' : statuteMiles <= 5 ? 'MVFR' : 'VFR';

export const classifyUsFlightCategory = (observation: MetarObservation): UsFlightCategory => {
  if (observation.visibility === null) {
    return { kind: 'unavailable', reason: 'visibility-unknown' };
  }
  const ceilingLayers = observation.clouds.filter(
    ({ amount }) => amount === 'BKN' || amount === 'OVC' || amount === 'VV',
  );
  if (ceilingLayers.some(({ baseFeetAgl }) => baseFeetAgl === null)) {
    return { kind: 'unavailable', reason: 'ceiling-unknown' };
  }
  const ceilingFeetAgl =
    ceilingLayers.length === 0
      ? null
      : Math.min(
          ...ceilingLayers.map(({ baseFeetAgl }) => baseFeetAgl ?? Number.POSITIVE_INFINITY),
        );
  const visibilityStatuteMiles = observation.visibility.metres / 1_609.344;
  if (observation.visibility.bound === 'less-than' && visibilityStatuteMiles >= 1) {
    return { kind: 'unavailable', reason: 'visibility-bound-ambiguous' };
  }
  const ceiling = ceilingCategory(ceilingFeetAgl);
  const visibility = visibilityCategory(visibilityStatuteMiles);
  const category = categoryRank[ceiling] >= categoryRank[visibility] ? ceiling : visibility;
  return {
    category,
    ceilingFeetAgl,
    kind: 'classified',
    limitingFactor:
      categoryRank[ceiling] === categoryRank[visibility]
        ? 'both'
        : categoryRank[ceiling] > categoryRank[visibility]
          ? 'ceiling'
          : 'visibility',
    visibilityBound: observation.visibility.bound,
    visibilityStatuteMiles,
  };
};
