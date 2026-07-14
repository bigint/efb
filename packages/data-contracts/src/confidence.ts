import { z } from 'zod';

export const verificationStatusSchema = z.enum([
  'unverified',
  'source-verified',
  'cross-checked',
  'invalid',
]);

export const confidenceSchema = z.enum(['unknown', 'low', 'medium', 'high']);
export const dataOriginSchema = z.enum(['real', 'simulated', 'derived']);

const boundedDisplayText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code >= 32 && code !== 127;
        }),
      'Provenance display text has control characters',
    );

export const dataProvenanceSchema = z
  .object({
    confidence: confidenceSchema,
    datasetVersion: boundedDisplayText(128),
    effectiveAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    jurisdiction: boundedDisplayText(64),
    origin: dataOriginSchema,
    retrievedAt: z.iso.datetime(),
    source: boundedDisplayText(240),
    sourceTimestamp: z.iso.datetime().nullable(),
    verificationStatus: verificationStatusSchema,
  })
  .strict();

export type DataProvenance = z.infer<typeof dataProvenanceSchema>;

export const isTrustedRealProvenance = (provenance: DataProvenance): boolean =>
  provenance.origin === 'real' &&
  (provenance.verificationStatus === 'source-verified' ||
    provenance.verificationStatus === 'cross-checked');

export type DataCurrency = 'current' | 'expired' | 'invalid' | 'not-effective' | 'unknown';

export const classifyDataCurrency = (provenance: DataProvenance, now: Date): DataCurrency => {
  if (!Number.isFinite(now.getTime()) || provenance.verificationStatus === 'invalid') {
    return 'invalid';
  }
  if (provenance.effectiveAt === null || provenance.expiresAt === null) return 'unknown';
  const effectiveAt = Date.parse(provenance.effectiveAt);
  const expiresAt = Date.parse(provenance.expiresAt);
  if (expiresAt <= effectiveAt || Date.parse(provenance.retrievedAt) > now.getTime()) {
    return 'invalid';
  }
  if (effectiveAt > now.getTime()) return 'not-effective';
  if (expiresAt <= now.getTime()) return 'expired';
  return 'current';
};

export const isStale = (provenance: DataProvenance, now: Date): boolean =>
  classifyDataCurrency(provenance, now) !== 'current';
