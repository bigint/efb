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

export type TafValidity =
  | { readonly kind: 'current' }
  | {
      readonly kind: 'unavailable';
      readonly reason:
        'clock-invalid' | 'not-yet-valid' | 'receipt-future' | 'validity-expired';
    };

export const evaluateTafValidity = (report: TafReport, now: Date): TafValidity => {
  const nowMilliseconds = now.getTime();
  if (!Number.isFinite(nowMilliseconds)) {
    return { kind: 'unavailable', reason: 'clock-invalid' };
  }
  if (Date.parse(report.receivedAt) > nowMilliseconds) {
    return { kind: 'unavailable', reason: 'receipt-future' };
  }
  if (Date.parse(report.validFrom) > nowMilliseconds) {
    return { kind: 'unavailable', reason: 'not-yet-valid' };
  }
  if (Date.parse(report.validTo) <= nowMilliseconds) {
    return { kind: 'unavailable', reason: 'validity-expired' };
  }
  return { kind: 'current' };
};
