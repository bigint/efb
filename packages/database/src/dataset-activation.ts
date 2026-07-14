import type { VerifiedDatasetGeneration } from './dataset-manifest';

export type ActivationBlock =
  | 'candidate-expired'
  | 'candidate-not-effective'
  | 'dataset-mismatch'
  | 'manifest-digest-invalid'
  | 'rollback-not-authorised'
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
  if (!isSha256(candidate.manifestDigest)) {
    return { allowed: false, block: 'manifest-digest-invalid' };
  }
  if (Date.parse(candidate.signatureVerifiedAt) > Date.parse(candidate.integrityCheckedAt)) {
    return { allowed: false, block: 'verification-after-integrity' };
  }
  if (Date.parse(candidate.manifest.effectiveAt) > nowMs) {
    return { allowed: false, block: 'candidate-not-effective' };
  }
  if (Date.parse(candidate.manifest.expiresAt) <= nowMs) {
    return { allowed: false, block: 'candidate-expired' };
  }
  if (current === null) return { allowed: true, replacesSequence: null };
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
