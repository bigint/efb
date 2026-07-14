import { decideDatasetActivation, type ActivationBlock } from './dataset-activation';
import type { VerifiedDatasetGeneration } from './dataset-manifest';

export const MAX_OFFLINE_DATASET_BYTES = 20 * 1024 * 1024 * 1024;

export interface ActiveOfflineGeneration {
  readonly activatedAt: string;
  readonly generation: VerifiedDatasetGeneration;
}

export type OfflineRegionUpdate =
  | { readonly kind: 'idle' }
  | {
      readonly attemptId: string;
      readonly expectedBytes: number;
      readonly kind: 'downloading';
      readonly receivedBytes: number;
      readonly startedAt: string;
    }
  | {
      readonly attemptId: string;
      readonly candidateDatasetId: string;
      readonly expectedBytes: number;
      readonly kind: 'verifying';
    }
  | {
      readonly allowRecoveryRollback: boolean;
      readonly attemptId: string;
      readonly generation: VerifiedDatasetGeneration;
      readonly kind: 'staged';
    }
  | {
      readonly code: OfflineRegionFailureCode;
      readonly failedAt: string;
      readonly kind: 'failed';
      readonly retryable: boolean;
    };

export type OfflineRegionFailureCode =
  | ActivationBlock
  | 'download-integrity-failed'
  | 'network-unavailable'
  | 'storage-unavailable'
  | 'unsupported-format';

export interface OfflineRegionState {
  readonly active: ActiveOfflineGeneration | null;
  readonly jurisdiction: string;
  readonly regionId: string;
  readonly update: OfflineRegionUpdate;
}

export type OfflineRegionEvent =
  | {
      readonly attemptId: string;
      readonly expectedBytes: number;
      readonly startedAt: string;
      readonly type: 'download-started';
    }
  | {
      readonly attemptId: string;
      readonly receivedBytes: number;
      readonly type: 'download-progressed';
    }
  | {
      readonly attemptId: string;
      readonly candidateDatasetId: string;
      readonly type: 'download-completed';
    }
  | {
      readonly allowRecoveryRollback: boolean;
      readonly attemptId: string;
      readonly generation: VerifiedDatasetGeneration;
      readonly now: Date;
      readonly type: 'verification-succeeded';
    }
  | {
      readonly attemptId: string;
      readonly code: Exclude<
        OfflineRegionFailureCode,
        ActivationBlock | 'network-unavailable' | 'storage-unavailable'
      >;
      readonly failedAt: string;
      readonly type: 'verification-failed';
    }
  | {
      readonly attemptId: string;
      readonly committedAt: string;
      readonly now: Date;
      readonly type: 'activation-committed';
    }
  | {
      readonly attemptId: string;
      readonly code: 'network-unavailable' | 'storage-unavailable';
      readonly failedAt: string;
      readonly type: 'transfer-failed';
    }
  | { readonly type: 'update-cleared' };

export type OfflineRegionTransition =
  | { readonly accepted: true; readonly state: OfflineRegionState }
  | { readonly accepted: false; readonly reason: OfflineRegionTransitionBlock };

export type OfflineRegionTransitionBlock =
  | ActivationBlock
  | 'attempt-mismatch'
  | 'candidate-mismatch'
  | 'download-incomplete'
  | 'invalid-byte-count'
  | 'invalid-identifier'
  | 'invalid-timestamp'
  | 'invalid-transition'
  | 'progress-regressed';

const validIdentifier = (value: string): boolean =>
  value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9._:-]+$/u.test(value);

const validTimestamp = (value: string): boolean => Number.isFinite(Date.parse(value));

const accepted = (
  state: OfflineRegionState,
  update: OfflineRegionUpdate,
): OfflineRegionTransition => ({ accepted: true, state: { ...state, update } });

const failed = (
  state: OfflineRegionState,
  code: OfflineRegionFailureCode,
  failedAt: string,
  retryable: boolean,
): OfflineRegionTransition => accepted(state, { code, failedAt, kind: 'failed', retryable });

export const reduceOfflineRegionState = (
  state: OfflineRegionState,
  event: OfflineRegionEvent,
): OfflineRegionTransition => {
  switch (event.type) {
    case 'download-started': {
      if (!validIdentifier(event.attemptId)) {
        return { accepted: false, reason: 'invalid-identifier' };
      }
      if (
        !Number.isSafeInteger(event.expectedBytes) ||
        event.expectedBytes <= 0 ||
        event.expectedBytes > MAX_OFFLINE_DATASET_BYTES
      ) {
        return { accepted: false, reason: 'invalid-byte-count' };
      }
      if (!validTimestamp(event.startedAt)) {
        return { accepted: false, reason: 'invalid-timestamp' };
      }
      if (state.update.kind !== 'idle' && state.update.kind !== 'failed') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      return accepted(state, {
        attemptId: event.attemptId,
        expectedBytes: event.expectedBytes,
        kind: 'downloading',
        receivedBytes: 0,
        startedAt: event.startedAt,
      });
    }
    case 'download-progressed': {
      if (state.update.kind !== 'downloading') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      if (state.update.attemptId !== event.attemptId) {
        return { accepted: false, reason: 'attempt-mismatch' };
      }
      if (
        !Number.isSafeInteger(event.receivedBytes) ||
        event.receivedBytes < 0 ||
        event.receivedBytes > state.update.expectedBytes
      ) {
        return { accepted: false, reason: 'invalid-byte-count' };
      }
      if (event.receivedBytes < state.update.receivedBytes) {
        return { accepted: false, reason: 'progress-regressed' };
      }
      return accepted(state, { ...state.update, receivedBytes: event.receivedBytes });
    }
    case 'download-completed': {
      if (state.update.kind !== 'downloading') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      if (state.update.attemptId !== event.attemptId) {
        return { accepted: false, reason: 'attempt-mismatch' };
      }
      if (state.update.receivedBytes !== state.update.expectedBytes) {
        return { accepted: false, reason: 'download-incomplete' };
      }
      if (!validIdentifier(event.candidateDatasetId)) {
        return { accepted: false, reason: 'invalid-identifier' };
      }
      return accepted(state, {
        attemptId: event.attemptId,
        candidateDatasetId: event.candidateDatasetId,
        expectedBytes: state.update.expectedBytes,
        kind: 'verifying',
      });
    }
    case 'verification-succeeded': {
      if (state.update.kind !== 'verifying') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      if (state.update.attemptId !== event.attemptId) {
        return { accepted: false, reason: 'attempt-mismatch' };
      }
      if (state.update.candidateDatasetId !== event.generation.manifest.datasetId) {
        return { accepted: false, reason: 'candidate-mismatch' };
      }
      if (
        event.generation.manifest.regionId !== state.regionId ||
        event.generation.manifest.jurisdiction !== state.jurisdiction
      ) {
        return { accepted: false, reason: 'dataset-mismatch' };
      }
      const decision = decideDatasetActivation({
        allowRecoveryRollback: event.allowRecoveryRollback,
        candidate: event.generation,
        current: state.active?.generation ?? null,
        now: event.now,
      });
      if (!decision.allowed) return { accepted: false, reason: decision.block };
      return accepted(state, {
        allowRecoveryRollback: event.allowRecoveryRollback,
        attemptId: event.attemptId,
        generation: event.generation,
        kind: 'staged',
      });
    }
    case 'verification-failed': {
      if (state.update.kind !== 'verifying') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      if (state.update.attemptId !== event.attemptId) {
        return { accepted: false, reason: 'attempt-mismatch' };
      }
      if (!validTimestamp(event.failedAt)) {
        return { accepted: false, reason: 'invalid-timestamp' };
      }
      return failed(state, event.code, event.failedAt, false);
    }
    case 'activation-committed': {
      if (state.update.kind !== 'staged') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      if (state.update.attemptId !== event.attemptId) {
        return { accepted: false, reason: 'attempt-mismatch' };
      }
      if (!validTimestamp(event.committedAt)) {
        return { accepted: false, reason: 'invalid-timestamp' };
      }
      const decision = decideDatasetActivation({
        allowRecoveryRollback: state.update.allowRecoveryRollback,
        candidate: state.update.generation,
        current: state.active?.generation ?? null,
        now: event.now,
      });
      if (!decision.allowed) return { accepted: false, reason: decision.block };
      return {
        accepted: true,
        state: {
          ...state,
          active: { activatedAt: event.committedAt, generation: state.update.generation },
          update: { kind: 'idle' },
        },
      };
    }
    case 'transfer-failed': {
      if (state.update.kind !== 'downloading') {
        return { accepted: false, reason: 'invalid-transition' };
      }
      if (state.update.attemptId !== event.attemptId) {
        return { accepted: false, reason: 'attempt-mismatch' };
      }
      if (!validTimestamp(event.failedAt)) {
        return { accepted: false, reason: 'invalid-timestamp' };
      }
      return failed(state, event.code, event.failedAt, true);
    }
    case 'update-cleared':
      return accepted(state, { kind: 'idle' });
  }
};

export type OfflineRegionAvailability =
  | { readonly kind: 'absent' }
  | { readonly active: ActiveOfflineGeneration; readonly kind: 'current' }
  | { readonly active: ActiveOfflineGeneration; readonly kind: 'expired' }
  | { readonly active: ActiveOfflineGeneration; readonly kind: 'invalid-generation' }
  | { readonly active: ActiveOfflineGeneration; readonly kind: 'not-effective' }
  | { readonly active: ActiveOfflineGeneration; readonly kind: 'clock-invalid' };

export const evaluateOfflineRegionAvailability = (
  state: OfflineRegionState,
  now: Date,
): OfflineRegionAvailability => {
  if (state.active === null) return { kind: 'absent' };
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return { active: state.active, kind: 'clock-invalid' };
  const effectiveAt = Date.parse(state.active.generation.manifest.effectiveAt);
  const expiresAt = Date.parse(state.active.generation.manifest.expiresAt);
  if (
    !Number.isFinite(effectiveAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= effectiveAt
  ) {
    return { active: state.active, kind: 'invalid-generation' };
  }
  if (effectiveAt > nowMs) return { active: state.active, kind: 'not-effective' };
  if (expiresAt <= nowMs) return { active: state.active, kind: 'expired' };
  return { active: state.active, kind: 'current' };
};
