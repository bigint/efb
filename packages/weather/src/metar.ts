import { z } from 'zod';

import {
  celsius,
  classifyDataCurrency,
  dataProvenanceSchema,
  feet,
  hectopascals,
  knots,
  metres,
  trueDegrees,
  type Celsius,
  type DataProvenance,
  type Feet,
  type Hectopascals,
  type Knots,
  type Metres,
  type TrueDegrees,
} from '@driftline/data-contracts';

const metarInputSchema = z
  .object({
    provenance: dataProvenanceSchema,
    raw: z.string().trim().min(1).max(4_096),
    receivedAt: z.iso.datetime(),
  })
  .strict();

export interface MetarWind {
  readonly direction: TrueDegrees | null;
  readonly gust: Knots | null;
  readonly speed: Knots;
  readonly variable: boolean;
  readonly variableFrom: TrueDegrees | null;
  readonly variableTo: TrueDegrees | null;
}

export interface MetarVisibility {
  readonly bound: 'exact' | 'greater-than' | 'less-than';
  readonly metres: Metres;
  readonly sourceUnit: 'metres' | 'statute-miles';
}

export interface MetarCloudLayer {
  readonly amount: 'BKN' | 'CLR' | 'FEW' | 'NCD' | 'NSC' | 'OVC' | 'SCT' | 'SKC' | 'VV';
  readonly baseFeetAgl: Feet | null;
  readonly convectiveType: 'CB' | 'TCU' | null;
}

export interface MetarObservation {
  readonly altimeter: Hectopascals | null;
  readonly automated: boolean;
  readonly cavok: boolean;
  readonly clouds: readonly MetarCloudLayer[];
  readonly corrected: boolean;
  readonly dewpoint: Celsius | null;
  readonly kind: 'METAR' | 'SPECI' | 'unknown';
  readonly observedAt: string;
  readonly presentWeatherCodes: readonly string[];
  readonly provenance: DataProvenance;
  readonly raw: string;
  readonly receivedAt: string;
  readonly remarks: string | null;
  readonly station: string;
  readonly temperature: Celsius | null;
  readonly unparsedBodyGroups: readonly string[];
  readonly visibility: MetarVisibility | null;
  readonly wind: MetarWind | null;
}

export type MetarCurrency =
  | { readonly ageMilliseconds: number; readonly kind: 'current' }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        | 'clock-invalid'
        | 'observation-future'
        | 'observation-stale'
        | 'provenance-expired'
        | 'provenance-invalid'
        | 'provenance-not-effective'
        | 'provenance-unknown'
        | 'receipt-future';
    };

export const evaluateMetarCurrency = (
  observation: MetarObservation,
  now: Date,
  maximumAgeMilliseconds = 60 * 60 * 1_000,
): MetarCurrency => {
  const nowMs = now.getTime();
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(maximumAgeMilliseconds) ||
    maximumAgeMilliseconds <= 0
  ) {
    return { kind: 'unavailable', reason: 'clock-invalid' };
  }
  const observedAt = Date.parse(observation.observedAt);
  const receivedAt = Date.parse(observation.receivedAt);
  if (observedAt > nowMs) return { kind: 'unavailable', reason: 'observation-future' };
  if (receivedAt > nowMs) return { kind: 'unavailable', reason: 'receipt-future' };
  const provenanceCurrency = classifyDataCurrency(observation.provenance, now);
  if (provenanceCurrency !== 'current') {
    return { kind: 'unavailable', reason: `provenance-${provenanceCurrency}` };
  }
  const ageMilliseconds = nowMs - observedAt;
  if (ageMilliseconds > maximumAgeMilliseconds) {
    return { kind: 'unavailable', reason: 'observation-stale' };
  }
  return { ageMilliseconds, kind: 'current' };
};

const parseSignedTemperature = (value: string): Celsius =>
  celsius(Number(value.startsWith('M') ? `-${value.slice(1)}` : value));

const resolveObservedAt = (group: string, receivedAt: Date): string => {
  const match = /^(\d{2})(\d{2})(\d{2})Z$/u.exec(group);
  if (match === null) throw new RangeError('METAR observation time is missing or malformed');
  const day = Number(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new RangeError('METAR observation time is outside its valid range');
  }
  const candidates = [-1, 0, 1]
    .map((monthOffset) => {
      const year = receivedAt.getUTCFullYear();
      const month = receivedAt.getUTCMonth() + monthOffset;
      const value = new Date(Date.UTC(year, month, day, hour, minute));
      const expectedMonth = ((month % 12) + 12) % 12;
      return value.getUTCDate() === day && value.getUTCMonth() === expectedMonth ? value : null;
    })
    .filter((value): value is Date => value !== null)
    .sort(
      (left, right) =>
        Math.abs(left.getTime() - receivedAt.getTime()) -
        Math.abs(right.getTime() - receivedAt.getTime()),
    );
  const observedAt = candidates[0];
  if (
    observedAt === undefined ||
    Math.abs(observedAt.getTime() - receivedAt.getTime()) > 20 * 24 * 60 * 60 * 1_000
  ) {
    throw new RangeError('METAR observation day cannot be resolved near receipt time');
  }
  return observedAt.toISOString();
};

const parseWind = (group: string): MetarWind | null => {
  const match = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/u.exec(group);
  if (match === null) return null;
  const directionValue = match[1] === 'VRB' ? null : Number(match[1]);
  if (directionValue !== null && directionValue > 360) return null;
  const direction =
    directionValue === null ? null : trueDegrees(directionValue === 360 ? 0 : directionValue);
  return {
    direction,
    gust: match[3] === undefined ? null : knots(Number(match[3])),
    speed: knots(Number(match[2])),
    variable: match[1] === 'VRB',
    variableFrom: null,
    variableTo: null,
  };
};

const fraction = (value: string): number | null => {
  const match = /^(\d+)\/(\d+)$/u.exec(value);
  if (match === null) return null;
  const denominator = Number(match[2]);
  return denominator === 0 ? null : Number(match[1]) / denominator;
};

const parseVisibility = (group: string): MetarVisibility | null => {
  const match = /^([PM]?)(\d+(?:\/\d+)?)SM$/u.exec(group);
  if (match === null) return null;
  const numericText = match[2];
  if (numericText === undefined) return null;
  const numeric = numericText.includes('/') ? fraction(numericText) : Number(numericText);
  if (numeric === null || !Number.isFinite(numeric)) return null;
  return {
    bound: match[1] === 'P' ? 'greater-than' : match[1] === 'M' ? 'less-than' : 'exact',
    metres: metres(numeric * 1_609.344),
    sourceUnit: 'statute-miles',
  };
};

const parseMixedVisibility = (
  whole: string,
  fractionalGroup: string,
): MetarVisibility | null => {
  if (!/^\d+$/u.test(whole)) return null;
  const match = /^(\d+\/\d+)SM$/u.exec(fractionalGroup);
  const fractional = match?.[1] === undefined ? null : fraction(match[1]);
  if (fractional === null) return null;
  return {
    bound: 'exact',
    metres: metres((Number(whole) + fractional) * 1_609.344),
    sourceUnit: 'statute-miles',
  };
};

const parseCloud = (group: string): MetarCloudLayer | null => {
  const clear = /^(CLR|SKC|NSC|NCD)$/u.exec(group);
  if (clear !== null) {
    return {
      amount: clear[1] as MetarCloudLayer['amount'],
      baseFeetAgl: null,
      convectiveType: null,
    };
  }
  const layer = /^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU)?$/u.exec(group);
  if (layer === null) return null;
  return {
    amount: layer[1] as MetarCloudLayer['amount'],
    baseFeetAgl: layer[2] === '///' ? null : feet(Number(layer[2]) * 100),
    convectiveType: (layer[3] as 'CB' | 'TCU' | undefined) ?? null,
  };
};

const parseAltimeter = (group: string): Hectopascals | null => {
  const inches = /^A(\d{4})$/u.exec(group);
  if (inches !== null) {
    const pressure = (Number(inches[1]) / 100) * 33.863_886_666_7;
    return pressure >= 800 && pressure <= 1_100 ? hectopascals(pressure) : null;
  }
  const metric = /^Q(\d{4})$/u.exec(group);
  if (metric === null) return null;
  const pressure = Number(metric[1]);
  return pressure >= 800 && pressure <= 1_100 ? hectopascals(pressure) : null;
};

const isPresentWeather = (group: string): boolean =>
  /^(?:\+|-|VC)?(?:MI|PR|BC|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP)?(?:BR|FG|FU|VA|DU|SA|HZ|PY)?$/u.test(
    group,
  ) && group.length >= 2;

export const parseMetar = (input: unknown): MetarObservation => {
  const value = metarInputSchema.parse(input);
  const receivedAt = new Date(value.receivedAt);
  const raw = value.raw.replaceAll(/\s+/gu, ' ').trim();
  const tokens = raw.split(' ');
  let cursor = 0;
  const first = tokens[cursor];
  const kind = first === 'METAR' || first === 'SPECI' ? first : 'unknown';
  if (kind !== 'unknown') cursor += 1;
  const station = tokens[cursor];
  if (station === undefined || !/^[A-Z0-9]{4}$/u.test(station)) {
    throw new RangeError('METAR station identifier is missing or malformed');
  }
  cursor += 1;
  const timeGroup = tokens[cursor];
  if (timeGroup === undefined) throw new RangeError('METAR observation time is missing');
  const observedAt = resolveObservedAt(timeGroup, receivedAt);
  cursor += 1;

  let altimeter: Hectopascals | null = null;
  let automated = false;
  let cavok = false;
  const clouds: MetarCloudLayer[] = [];
  let corrected = false;
  let dewpoint: Celsius | null = null;
  const presentWeatherCodes: string[] = [];
  let remarks: string | null = null;
  let temperature: Celsius | null = null;
  const unparsedBodyGroups: string[] = [];
  let visibility: MetarVisibility | null = null;
  let wind: MetarWind | null = null;

  while (cursor < tokens.length) {
    const group = tokens[cursor];
    if (group === undefined) break;
    if (group === 'RMK') {
      remarks = tokens.slice(cursor + 1).join(' ') || null;
      break;
    }
    if (group === 'AUTO') automated = true;
    else if (group === 'COR') corrected = true;
    else if (group === 'CAVOK') {
      cavok = true;
      visibility = { bound: 'greater-than', metres: metres(10_000), sourceUnit: 'metres' };
    } else {
      const parsedWind = parseWind(group);
      const parsedVisibility = parseVisibility(group);
      const parsedCloud = parseCloud(group);
      const parsedAltimeter = parseAltimeter(group);
      const temperatures = /^(M?\d{2})\/(M?\d{2}|\/\/)$/.exec(group);
      const variation = /^(\d{3})V(\d{3})$/u.exec(group);
      const nextGroup = tokens[cursor + 1];
      const mixedVisibility =
        nextGroup === undefined ? null : parseMixedVisibility(group, nextGroup);
      if (parsedWind !== null) wind = parsedWind;
      else if (variation !== null) {
        const from = Number(variation[1]);
        const to = Number(variation[2]);
        if (wind === null || from > 360 || to > 360) unparsedBodyGroups.push(group);
        else {
          wind = {
            direction: wind.direction,
            gust: wind.gust,
            speed: wind.speed,
            variable: wind.variable,
            variableFrom: trueDegrees(from === 360 ? 0 : from),
            variableTo: trueDegrees(to === 360 ? 0 : to),
          };
        }
      } else if (parsedVisibility !== null) visibility = parsedVisibility;
      else if (mixedVisibility !== null) {
        visibility = mixedVisibility;
        cursor += 1;
      } else if (parsedCloud !== null) clouds.push(parsedCloud);
      else if (temperatures !== null) {
        temperature = parseSignedTemperature(temperatures[1] ?? '');
        dewpoint =
          temperatures[2] === '//' ? null : parseSignedTemperature(temperatures[2] ?? '');
      } else if (parsedAltimeter !== null) altimeter = parsedAltimeter;
      else if (isPresentWeather(group)) presentWeatherCodes.push(group);
      else unparsedBodyGroups.push(group);
    }
    cursor += 1;
  }

  return {
    altimeter,
    automated,
    cavok,
    clouds,
    corrected,
    dewpoint,
    kind,
    observedAt,
    presentWeatherCodes,
    provenance: value.provenance,
    raw: value.raw,
    receivedAt: value.receivedAt,
    remarks,
    station,
    temperature,
    unparsedBodyGroups,
    visibility,
    wind,
  };
};
