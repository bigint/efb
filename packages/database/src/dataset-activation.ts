import { datasetManifestSchema, type VerifiedDatasetGeneration } from './dataset-manifest';

export type ActivationBlock =
  | 'candidate-expired'
  | 'candidate-manifest-invalid'
  | 'candidate-not-effective'
  | 'candidate-timestamp-invalid'
  | 'candidate-validity-window-invalid'
  | 'clock-invalid'
  | 'dataset-mismatch'
  | 'manifest-digest-invalid'
  | 'rollback-not-authorised'
  | 'current-generation-invalid'
  | 'signature-key-invalid'
  | 'verification-before-generation'
  | 'verification-in-future'
  | 'verification-timestamp-invalid'
  | 'verification-after-integrity';

export type ActivationDecision =
  | { readonly allowed: true; readonly replacesSequence: number | null }
  | { readonly allowed: false; readonly block: ActivationBlock };

interface ActivationInput {
  readonly allowRecoveryRollback: boolean;
  readonly candidate: VerifiedDatasetGeneration;
  readonly current: VerifiedDatasetGeneration | null;
  readonly now: Date;
}

const isSha256 = (value: string): boolean => /^[a-f0-9]{64}$/u.test(value);
const isSignatureKeyId = (value: string): boolean =>
  value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/u.test(value);

export const isVerifiedDatasetGenerationValidAt = (
  generation: VerifiedDatasetGeneration,
  nowMs: number,
): boolean => {
  if (!Number.isFinite(nowMs)) return false;
  const generatedAt = Date.parse(generation.manifest.generatedAt);
  const signatureVerifiedAt = Date.parse(generation.signatureVerifiedAt);
  const integrityCheckedAt = Date.parse(generation.integrityCheckedAt);
  return (
    datasetManifestSchema.safeParse(generation.manifest).success &&
    isSha256(generation.manifestDigest) &&
    isSignatureKeyId(generation.signatureKeyId) &&
    Number.isFinite(generatedAt) &&
    Number.isFinite(signatureVerifiedAt) &&
    Number.isFinite(integrityCheckedAt) &&
    generatedAt <= signatureVerifiedAt &&
    signatureVerifiedAt <= integrityCheckedAt &&
    integrityCheckedAt <= nowMs
  );
};

/**
 * Pure pre-activation policy. Filesystem/SQLite adapters still must activate the verified
 * generation atomically and retain the prior generation for rollback.
 */
export const decideDatasetActivation = ({
  allowRecoveryRollback,
  candidate,
  current,
  now,
}: ActivationInput): ActivationDecision => {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return { allowed: false, block: 'clock-invalid' };
  if (!isSha256(candidate.manifestDigest)) {
    return { allowed: false, block: 'manifest-digest-invalid' };
  }
  if (!isSignatureKeyId(candidate.signatureKeyId)) {
    return { allowed: false, block: 'signature-key-invalid' };
  }
  const signatureVerifiedAt = Date.parse(candidate.signatureVerifiedAt);
  const integrityCheckedAt = Date.parse(candidate.integrityCheckedAt);
  if (!Number.isFinite(signatureVerifiedAt) || !Number.isFinite(integrityCheckedAt)) {
    return { allowed: false, block: 'verification-timestamp-invalid' };
  }
  if (signatureVerifiedAt > integrityCheckedAt) {
    return { allowed: false, block: 'verification-after-integrity' };
  }
  if (integrityCheckedAt > nowMs) {
    return { allowed: false, block: 'verification-in-future' };
  }
  const generatedAt = Date.parse(candidate.manifest.generatedAt);
  if (Number.isFinite(generatedAt) && generatedAt > signatureVerifiedAt) {
    return { allowed: false, block: 'verification-before-generation' };
  }
  const effectiveAt = Date.parse(candidate.manifest.effectiveAt);
  const expiresAt = Date.parse(candidate.manifest.expiresAt);
  if (!Number.isFinite(effectiveAt) || !Number.isFinite(expiresAt)) {
    return { allowed: false, block: 'candidate-timestamp-invalid' };
  }
  if (expiresAt <= effectiveAt) {
    return { allowed: false, block: 'candidate-validity-window-invalid' };
  }
  if (effectiveAt > nowMs) {
    return { allowed: false, block: 'candidate-not-effective' };
  }
  if (expiresAt <= nowMs) {
    return { allowed: false, block: 'candidate-expired' };
  }
  if (!datasetManifestSchema.safeParse(candidate.manifest).success) {
    return { allowed: false, block: 'candidate-manifest-invalid' };
  }
  if (current === null) return { allowed: true, replacesSequence: null };
  if (!isVerifiedDatasetGenerationValidAt(current, nowMs)) {
    return { allowed: false, block: 'current-generation-invalid' };
  }
  if (
    current.manifest.regionId !== candidate.manifest.regionId ||
    current.manifest.jurisdiction !== candidate.manifest.jurisdiction
  ) {
    return { allowed: false, block: 'dataset-mismatch' };
  }
  if (candidate.manifest.sequence <= current.manifest.sequence && !allowRecoveryRollback) {
    return { allowed: false, block: 'rollback-not-authorised' };
  }
  return { allowed: true, replacesSequence: current.manifest.sequence };
};
