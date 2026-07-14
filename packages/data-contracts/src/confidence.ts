import { z } from 'zod';

export const verificationStatusSchema = z.enum([
  'unverified',
  'source-verified',
  'cross-checked',
  'invalid',
]);

export const confidenceSchema = z.enum(['unknown', 'low', 'medium', 'high']);
export const dataOriginSchema = z.enum(['real', 'simulated', 'derived']);

export const dataProvenanceSchema = z
  .object({
    confidence: confidenceSchema,
    datasetVersion: z.string().min(1),
    effectiveAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    jurisdiction: z.string().min(1),
    origin: dataOriginSchema,
    retrievedAt: z.iso.datetime(),
    source: z.string().min(1),
    sourceTimestamp: z.iso.datetime().nullable(),
    verificationStatus: verificationStatusSchema,
  })
  .strict();

export type DataProvenance = z.infer<typeof dataProvenanceSchema>;

export type DataCurrency = 'current' | 'expired' | 'invalid' | 'not-effective' | 'unknown';

export const classifyDataCurrency = (provenance: DataProvenance, now: Date): DataCurrency => {
  if (!Number.isFinite(now.getTime()) || provenance.verificationStatus === 'invalid') {
    return 'invalid';
  }
  if (provenance.effectiveAt === null || provenance.expiresAt === null) return 'unknown';
  if (Date.parse(provenance.effectiveAt) > now.getTime()) return 'not-effective';
  if (Date.parse(provenance.expiresAt) <= now.getTime()) return 'expired';
  return 'current';
};

export const isStale = (provenance: DataProvenance, now: Date): boolean =>
  classifyDataCurrency(provenance, now) !== 'current';
