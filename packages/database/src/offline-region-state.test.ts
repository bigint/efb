import { describe, expect, it } from 'vitest';

import type { VerifiedDatasetGeneration } from './dataset-manifest';
import {
  evaluateOfflineRegionAvailability,
  MAX_OFFLINE_DATASET_BYTES,
  reduceOfflineRegionState,
  type OfflineRegionEvent,
  type OfflineRegionState,
} from './offline-region-state';

const now = new Date('2026-07-14T12:00:00.000Z');

const generation = (
  sequence: number,
  overrides: Partial<VerifiedDatasetGeneration['manifest']> = {},
): VerifiedDatasetGeneration => ({
  integrityCheckedAt: '2026-07-14T11:01:00.000Z',
  manifest: {
    datasetId: `019f5f42-a146-7c00-861d-7ad2313bbbd${sequence}`,
    effectiveAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-08-01T00:00:00.000Z',
    files: [],
    formatVersion: 1,
    generatedAt: '2026-06-25T00:00:00.000Z',
    jurisdiction: 'US-DEMO',
    regionId: 'us-demo-west',
    sequence,
    source: 'Test fixture',
    sourceVersion: `test-${sequence}`,
    ...overrides,
  },
  manifestDigest: 'a'.repeat(64),
  signatureKeyId: 'test-key',
  signatureVerifiedAt: '2026-07-14T11:00:00.000Z',
});

const initial: OfflineRegionState = {
  active: null,
  jurisdiction: 'US-DEMO',
  regionId: 'us-demo-west',
  update: { kind: 'idle' },
};

const step = (state: OfflineRegionState, event: OfflineRegionEvent): OfflineRegionState => {
  const transition = reduceOfflineRegionState(state, event);
  expect(transition.accepted).toBe(true);
  if (!transition.accepted) throw new Error(transition.reason);
  return transition.state;
};

const activate = (
  startingState: OfflineRegionState,
  candidate: VerifiedDatasetGeneration,
  allowRecoveryRollback = false,
): OfflineRegionState => {
  const attemptId = `attempt-${candidate.manifest.sequence}`;
  let state = step(startingState, {
    attemptId,
    expectedBytes: 100,
    startedAt: '2026-07-14T10:00:00.000Z',
    type: 'download-started',
  });
  state = step(state, { attemptId, receivedBytes: 100, type: 'download-progressed' });
  state = step(state, {
    attemptId,
    candidateDatasetId: candidate.manifest.datasetId,
    type: 'download-completed',
  });
  state = step(state, {
    allowRecoveryRollback,
    attemptId,
    generation: candidate,
    now,
    type: 'verification-succeeded',
  });
  return step(state, {
    attemptId,
    committedAt: '2026-07-14T12:00:00.000Z',
    now,
    type: 'activation-committed',
  });
};

describe('offline region lifecycle', () => {
  it('moves a complete verified download into active state', () => {
    const state = activate(initial, generation(1));
    expect(state.update).toEqual({ kind: 'idle' });
    expect(state.active?.generation.manifest.sequence).toBe(1);
    expect(evaluateOfflineRegionAvailability(state, now).kind).toBe('current');
  });

  it('does not verify a partial download', () => {
    let state = step(initial, {
      attemptId: 'attempt-1',
      expectedBytes: 100,
      startedAt: '2026-07-14T10:00:00.000Z',
      type: 'download-started',
    });
    state = step(state, {
      attemptId: 'attempt-1',
      receivedBytes: 99,
      type: 'download-progressed',
    });
    expect(
      reduceOfflineRegionState(state, {
        attemptId: 'attempt-1',
        candidateDatasetId: generation(1).manifest.datasetId,
        type: 'download-completed',
      }),
    ).toEqual({ accepted: false, reason: 'download-incomplete' });
  });

  it('rejects regressing, oversized, and cross-attempt progress', () => {
    let state = step(initial, {
      attemptId: 'attempt-1',
      expectedBytes: 100,
      startedAt: '2026-07-14T10:00:00.000Z',
      type: 'download-started',
    });
    state = step(state, {
      attemptId: 'attempt-1',
      receivedBytes: 50,
      type: 'download-progressed',
    });
    expect(
      reduceOfflineRegionState(state, {
        attemptId: 'attempt-1',
        receivedBytes: 49,
        type: 'download-progressed',
      }),
    ).toEqual({ accepted: false, reason: 'progress-regressed' });
    expect(
      reduceOfflineRegionState(state, {
        attemptId: 'different-attempt',
        receivedBytes: 51,
        type: 'download-progressed',
      }),
    ).toEqual({ accepted: false, reason: 'attempt-mismatch' });
    expect(
      reduceOfflineRegionState(initial, {
        attemptId: 'attempt-large',
        expectedBytes: MAX_OFFLINE_DATASET_BYTES + 1,
        startedAt: '2026-07-14T10:00:00.000Z',
        type: 'download-started',
      }),
    ).toEqual({ accepted: false, reason: 'invalid-byte-count' });
  });

  it('retains the active generation when an update transfer fails', () => {
    const active = activate(initial, generation(1));
    let updating = step(active, {
      attemptId: 'attempt-2',
      expectedBytes: 100,
      startedAt: '2026-07-14T13:00:00.000Z',
      type: 'download-started',
    });
    updating = step(updating, {
      attemptId: 'attempt-2',
      code: 'network-unavailable',
      failedAt: '2026-07-14T13:01:00.000Z',
      type: 'transfer-failed',
    });
    expect(updating.active).toEqual(active.active);
    expect(updating.update).toMatchObject({ kind: 'failed', retryable: true });
  });

  it('rejects a candidate for a different region even without an active generation', () => {
    const candidate = generation(1, { regionId: 'other-region' });
    let state = step(initial, {
      attemptId: 'attempt-1',
      expectedBytes: 1,
      startedAt: '2026-07-14T10:00:00.000Z',
      type: 'download-started',
    });
    state = step(state, {
      attemptId: 'attempt-1',
      receivedBytes: 1,
      type: 'download-progressed',
    });
    state = step(state, {
      attemptId: 'attempt-1',
      candidateDatasetId: candidate.manifest.datasetId,
      type: 'download-completed',
    });
    expect(
      reduceOfflineRegionState(state, {
        allowRecoveryRollback: false,
        attemptId: 'attempt-1',
        generation: candidate,
        now,
        type: 'verification-succeeded',
      }),
    ).toEqual({ accepted: false, reason: 'dataset-mismatch' });
  });

  it('requires explicit recovery authorization for rollback', () => {
    const active = activate(initial, generation(2));
    const startRollback = (allowRecoveryRollback: boolean) => {
      let state = step(active, {
        attemptId: 'attempt-1',
        expectedBytes: 1,
        startedAt: '2026-07-14T13:00:00.000Z',
        type: 'download-started',
      });
      state = step(state, {
        attemptId: 'attempt-1',
        receivedBytes: 1,
        type: 'download-progressed',
      });
      state = step(state, {
        attemptId: 'attempt-1',
        candidateDatasetId: generation(1).manifest.datasetId,
        type: 'download-completed',
      });
      return reduceOfflineRegionState(state, {
        allowRecoveryRollback,
        attemptId: 'attempt-1',
        generation: generation(1),
        now,
        type: 'verification-succeeded',
      });
    };

    expect(startRollback(false)).toEqual({
      accepted: false,
      reason: 'rollback-not-authorised',
    });
    expect(startRollback(true)).toMatchObject({
      accepted: true,
      state: { update: { allowRecoveryRollback: true, kind: 'staged' } },
    });
  });

  it('reports expired and invalid-clock active generations without deleting them', () => {
    const state = activate(initial, generation(1));
    expect(
      evaluateOfflineRegionAvailability(state, new Date('2026-08-01T00:00:00.000Z')).kind,
    ).toBe('expired');
    expect(evaluateOfflineRegionAvailability(state, new Date(Number.NaN)).kind).toBe(
      'clock-invalid',
    );
    expect(evaluateOfflineRegionAvailability(initial, now)).toEqual({ kind: 'absent' });
  });

  it('fails closed when restored active-generation timestamps are malformed', () => {
    const state: OfflineRegionState = {
      ...initial,
      active: {
        activatedAt: '2026-07-14T12:00:00.000Z',
        generation: generation(1, { expiresAt: 'not-a-timestamp' }),
      },
    };
    expect(evaluateOfflineRegionAvailability(state, now).kind).toBe('invalid-generation');
  });
});
