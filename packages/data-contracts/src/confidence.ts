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

export const isTrustedRealProvenance = (provenance: DataProvenance): boolean => {
  const parsed = dataProvenanceSchema.safeParse(provenance);
  return (
    parsed.success &&
    parsed.data.origin === 'real' &&
    (parsed.data.verificationStatus === 'source-verified' ||
      parsed.data.verificationStatus === 'cross-checked')
  );
};

export type DataCurrency = 'current' | 'expired' | 'invalid' | 'not-effective' | 'unknown';

export const classifyDataCurrency = (provenance: DataProvenance, now: Date): DataCurrency => {
  const parsed = dataProvenanceSchema.safeParse(provenance);
  const nowMs = now.getTime();
  if (
    !parsed.success ||
    !Number.isFinite(nowMs) ||
    parsed.data.verificationStatus === 'invalid' ||
    Date.parse(parsed.data.retrievedAt) > nowMs
  ) {
    return 'invalid';
  }
  const { effectiveAt: effectiveSource, expiresAt: expirySource } = parsed.data;
  if (effectiveSource === null && expirySource === null) return 'unknown';
  if (effectiveSource === null || expirySource === null) return 'invalid';
  const effectiveAt = Date.parse(effectiveSource);
  const expiresAt = Date.parse(expirySource);
  if (expiresAt <= effectiveAt) return 'invalid';
  if (effectiveAt > nowMs) return 'not-effective';
  if (expiresAt <= nowMs) return 'expired';
  return 'current';
};

export const isStale = (provenance: DataProvenance, now: Date): boolean =>
  classifyDataCurrency(provenance, now) !== 'current';
