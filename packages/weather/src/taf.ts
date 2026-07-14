import { z } from 'zod';

import { dataProvenanceSchema, type DataProvenance } from '@driftline/data-contracts';

const tafInputSchema = z
  .object({
    provenance: dataProvenanceSchema,
    raw: z.string().trim().min(1).max(8_192),
    receivedAt: z.iso.datetime(),
  })
  .strict();

export interface TafReport {
  readonly amendment: 'amended' | 'corrected' | 'original';
  readonly issuedAt: string;
  readonly product: 'TAF';
  readonly provenance: DataProvenance;
  readonly raw: string;
  readonly receivedAt: string;
  readonly station: string;
  readonly validFrom: string;
  readonly validTo: string;
}

export interface TafChangeGroup {
  readonly endsAt: string | null;
  readonly kind: 'becoming' | 'from' | 'probability' | 'probability-temporary' | 'temporary';
  readonly marker: string;
  readonly probabilityPercent: 30 | 40 | null;
  readonly rawConditions: string;
  readonly startsAt: string;
}

export interface TafTimeline {
  readonly baseForecastRaw: string;
  readonly groups: readonly TafChangeGroup[];
}

const dayCandidates = (
  day: number,
  hour: number,
  minute: number,
  reference: Date,
): readonly Date[] => {
  if (day < 1 || day > 31 || hour < 0 || hour > 24 || minute < 0 || minute > 59) return [];
  return [-1, 0, 1]
    .map((monthOffset) => {
      const year = reference.getUTCFullYear();
      const month = reference.getUTCMonth() + monthOffset;
      const base = new Date(Date.UTC(year, month, day, 0, minute));
      const expectedMonth = ((month % 12) + 12) % 12;
      if (base.getUTCDate() !== day || base.getUTCMonth() !== expectedMonth) return null;
      base.setUTCHours(hour);
      return base;
    })
    .filter((value): value is Date => value !== null);
};

const resolveIssueTime = (group: string, receivedAt: Date): Date => {
  const match = /^(\d{2})(\d{2})(\d{2})Z$/u.exec(group);
  if (match === null) throw new Error('TAF issue time is malformed');
  if (Number(match[2]) > 23) throw new Error('TAF issue time is malformed');
  const candidates = dayCandidates(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    receivedAt,
  )
    .filter(
      (candidate) => Math.abs(candidate.getTime() - receivedAt.getTime()) <= 20 * 86_400_000,
    )
    .sort(
      (left, right) =>
        Math.abs(left.getTime() - receivedAt.getTime()) -
        Math.abs(right.getTime() - receivedAt.getTime()),
    );
  const issue = candidates[0];
  if (issue === undefined) throw new Error('TAF issue time cannot be resolved near receipt');
  return issue;
};

const resolveValidity = (group: string, issuedAt: Date): readonly [Date, Date] => {
  const match = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/u.exec(group);
  if (match === null) throw new Error('TAF validity period is malformed');
  if (Number(match[2]) > 23) throw new Error('TAF validity start is malformed');
  const startCandidates = dayCandidates(Number(match[1]), Number(match[2]), 0, issuedAt)
    .filter((candidate) => {
      const offset = candidate.getTime() - issuedAt.getTime();
      return offset >= -12 * 3_600_000 && offset <= 24 * 3_600_000;
    })
    .sort(
      (left, right) =>
        Math.abs(left.getTime() - issuedAt.getTime()) -
        Math.abs(right.getTime() - issuedAt.getTime()),
    );
  const start = startCandidates[0];
  if (start === undefined) throw new Error('TAF validity start cannot be resolved');
  const end = dayCandidates(Number(match[3]), Number(match[4]), 0, start)
    .filter((candidate) => {
      const duration = candidate.getTime() - start.getTime();
      return duration > 0 && duration <= 48 * 3_600_000;
    })
    .sort((left, right) => left.getTime() - right.getTime())[0];
  if (end === undefined) throw new Error('TAF validity end cannot be resolved');
  return [start, end];
};

export const parseTafHeader = (input: unknown): TafReport => {
  const value = tafInputSchema.parse(input);
  const normalized = value.raw.replaceAll(/\s+/gu, ' ').trim();
  const header = /^TAF(?:\s+(AMD|COR))?\s+([A-Z0-9]{4})\s+(\d{6}Z)\s+(\d{4}\/\d{4})\b/u.exec(
    normalized,
  );
  if (header === null) throw new Error('TAF header is missing or malformed');
  const receivedAt = new Date(value.receivedAt);
  const issuedAt = resolveIssueTime(header[3] ?? '', receivedAt);
  const [validFrom, validTo] = resolveValidity(header[4] ?? '', issuedAt);
  return {
    amendment: header[1] === 'AMD' ? 'amended' : header[1] === 'COR' ? 'corrected' : 'original',
    issuedAt: issuedAt.toISOString(),
    product: 'TAF',
    provenance: value.provenance,
    raw: value.raw,
    receivedAt: value.receivedAt,
    station: header[2] ?? '',
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
  };
};

const resolveTimelinePoint = (
  day: number,
  hour: number,
  minute: number,
  report: TafReport,
  includeEnd: boolean,
): Date => {
  const validFrom = new Date(report.validFrom);
  const validTo = new Date(report.validTo);
  const candidate = dayCandidates(day, hour, minute, validFrom)
    .filter((value) => {
      const milliseconds = value.getTime();
      return (
        milliseconds >= validFrom.getTime() &&
        (includeEnd ? milliseconds <= validTo.getTime() : milliseconds < validTo.getTime())
      );
    })
    .sort((left, right) => left.getTime() - right.getTime())[0];
  if (candidate === undefined) throw new Error('TAF change time is outside report validity');
  return candidate;
};

const resolveTimelinePeriod = (value: string, report: TafReport): readonly [Date, Date] => {
  const match = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/u.exec(value);
  if (match === null || Number(match[2]) > 23) {
    throw new Error('TAF change period is malformed');
  }
  const start = resolveTimelinePoint(Number(match[1]), Number(match[2]), 0, report, false);
  const end = dayCandidates(Number(match[3]), Number(match[4]), 0, start)
    .filter((candidate) => {
      const time = candidate.getTime();
      return time > start.getTime() && time <= Date.parse(report.validTo);
    })
    .sort((left, right) => left.getTime() - right.getTime())[0];
  if (end === undefined) throw new Error('TAF change period end is outside report validity');
  return [start, end];
};

const isChangeMarker = (token: string): boolean =>
  token === 'BECMG' || token === 'TEMPO' || token.startsWith('FM') || token.startsWith('PROB');

export const parseTafTimeline = (report: TafReport): TafTimeline => {
  const normalized = report.raw.replaceAll(/\s+/gu, ' ').trim();
  const header = /^TAF(?:\s+(?:AMD|COR))?\s+[A-Z0-9]{4}\s+\d{6}Z\s+\d{4}\/\d{4}\b/u.exec(
    normalized,
  );
  if (header === null) throw new Error('TAF header is missing or malformed');
  const tokens = normalized.slice(header[0].length).trim().split(' ').filter(Boolean);
  const firstMarker = tokens.findIndex(isChangeMarker);
  const baseTokens = firstMarker < 0 ? tokens : tokens.slice(0, firstMarker);
  if (baseTokens.length === 0) throw new Error('TAF base forecast is missing');
  if (firstMarker < 0) return { baseForecastRaw: baseTokens.join(' '), groups: [] };

  const groups: TafChangeGroup[] = [];
  let index = firstMarker;
  while (index < tokens.length) {
    if (groups.length >= 32) throw new Error('TAF change group count exceeds supported limit');
    const token = tokens[index] ?? '';
    let consumed = 1;
    let endsAt: Date | null = null;
    let kind: TafChangeGroup['kind'];
    let marker = token;
    let probabilityPercent: 30 | 40 | null = null;
    let startsAt: Date;

    const from = /^FM(\d{2})(\d{2})(\d{2})$/u.exec(token);
    if (from !== null) {
      if (Number(from[2]) > 23) throw new Error('TAF FM time is malformed');
      kind = 'from';
      startsAt = resolveTimelinePoint(
        Number(from[1]),
        Number(from[2]),
        Number(from[3]),
        report,
        false,
      );
    } else if (token === 'TEMPO' || token === 'BECMG') {
      const periodToken = tokens[index + 1] ?? '';
      [startsAt, endsAt] = resolveTimelinePeriod(periodToken, report);
      consumed = 2;
      kind = token === 'TEMPO' ? 'temporary' : 'becoming';
      marker = `${token} ${periodToken}`;
    } else {
      const probability = /^PROB(30|40)$/u.exec(token);
      if (probability === null) throw new Error(`TAF change marker is malformed: ${token}`);
      probabilityPercent = Number(probability[1]) as 30 | 40;
      const temporary = tokens[index + 1] === 'TEMPO';
      const periodToken = tokens[index + (temporary ? 2 : 1)] ?? '';
      [startsAt, endsAt] = resolveTimelinePeriod(periodToken, report);
      consumed = temporary ? 3 : 2;
      kind = temporary ? 'probability-temporary' : 'probability';
      marker = temporary ? `${token} TEMPO ${periodToken}` : `${token} ${periodToken}`;
    }

    const bodyStart = index + consumed;
    let nextMarker = bodyStart;
    while (nextMarker < tokens.length && !isChangeMarker(tokens[nextMarker] ?? '')) {
      nextMarker += 1;
    }
    const body = tokens.slice(bodyStart, nextMarker);
    if (body.length === 0) throw new Error(`TAF change group ${marker} has no conditions`);
    groups.push({
      endsAt: endsAt?.toISOString() ?? null,
      kind,
      marker,
      probabilityPercent,
      rawConditions: body.join(' '),
      startsAt: startsAt.toISOString(),
    });
    index = nextMarker;
  }
  return { baseForecastRaw: baseTokens.join(' '), groups };
};

export type TafValidity =
  | { readonly kind: 'current' }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        | 'clock-invalid'
        | 'not-yet-valid'
        | 'provenance-non-real'
        | 'provenance-unverified'
        | 'receipt-future'
        | 'validity-expired';
    };

export const evaluateTafValidity = (report: TafReport, now: Date): TafValidity => {
  const nowMilliseconds = now.getTime();
  if (!Number.isFinite(nowMilliseconds)) {
    return { kind: 'unavailable', reason: 'clock-invalid' };
  }
  if (Date.parse(report.receivedAt) > nowMilliseconds) {
    return { kind: 'unavailable', reason: 'receipt-future' };
  }
  if (
    report.provenance.verificationStatus !== 'source-verified' &&
    report.provenance.verificationStatus !== 'cross-checked'
  ) {
    return { kind: 'unavailable', reason: 'provenance-unverified' };
  }
  if (report.provenance.origin !== 'real') {
    return { kind: 'unavailable', reason: 'provenance-non-real' };
  }
  if (Date.parse(report.validFrom) > nowMilliseconds) {
    return { kind: 'unavailable', reason: 'not-yet-valid' };
  }
  if (Date.parse(report.validTo) <= nowMilliseconds) {
    return { kind: 'unavailable', reason: 'validity-expired' };
  }
  return { kind: 'current' };
};
