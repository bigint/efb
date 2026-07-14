import { describe, expect, it } from 'vitest';

import { decideDatasetActivation } from './dataset-activation';
import { datasetManifestSchema, type VerifiedDatasetGeneration } from './dataset-manifest';

const manifest = (sequence: number, overrides: Record<string, unknown> = {}) =>
  datasetManifestSchema.parse({
    datasetId: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
    effectiveAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-08-01T00:00:00.000Z',
    files: [
      {
        byteLength: 42,
        mediaType: 'application/vnd.sqlite3',
        path: 'aviation.sqlite',
        sha256: 'a'.repeat(64),
      },
    ],
    formatVersion: 1,
    generatedAt: '2026-06-25T00:00:00.000Z',
    jurisdiction: 'US-DEMO',
    regionId: 'us-demo-west',
    sequence,
    source: 'Test fixture',
    sourceVersion: `test-${sequence}`,
    ...overrides,
  });

const generation = (
  sequence: number,
  overrides: Partial<VerifiedDatasetGeneration> = {},
): VerifiedDatasetGeneration => ({
  integrityCheckedAt: '2026-07-10T00:01:00.000Z',
  manifest: manifest(sequence),
  manifestDigest: 'b'.repeat(64),
  signatureKeyId: 'test-key-1',
  signatureVerifiedAt: '2026-07-10T00:00:00.000Z',
  ...overrides,
});

const now = new Date('2026-07-14T00:00:00.000Z');

describe('dataset activation policy', () => {
  it('allows a fresh, increasing, verified generation', () => {
    expect(
      decideDatasetActivation({
        allowRecoveryRollback: false,
        candidate: generation(2),
        current: generation(1),
        now,
      }),
    ).toEqual({ allowed: true, replacesSequence: 1 });
  });

  it.each([
    [
      'future effective time',
      generation(2, { manifest: manifest(2, { effectiveAt: '2026-07-15T00:00:00.000Z' }) }),
      'candidate-not-effective',
    ],
    [
      'expired candidate',
      generation(2, { manifest: manifest(2, { expiresAt: '2026-07-14T00:00:00.000Z' }) }),
      'candidate-expired',
    ],
    [
      'invalid digest',
      generation(2, { manifestDigest: 'not-a-digest' }),
      'manifest-digest-invalid',
    ],
    [
      'misordered verification',
      generation(2, { integrityCheckedAt: '2026-07-09T00:00:00.000Z' }),
      'verification-after-integrity',
    ],
    [
      'invalid verification timestamp',
      generation(2, { signatureVerifiedAt: 'not-a-timestamp' }),
      'verification-timestamp-invalid',
    ],
  ] as const)('blocks %s', (_label, candidate, block) => {
    expect(
      decideDatasetActivation({
        allowRecoveryRollback: false,
        candidate,
        current: generation(1),
        now,
      }),
    ).toEqual({ allowed: false, block });
  });

  it('fails closed when the activation clock is invalid', () => {
    expect(
      decideDatasetActivation({
        allowRecoveryRollback: false,
        candidate: generation(2),
        current: generation(1),
        now: new Date(Number.NaN),
      }),
    ).toEqual({ allowed: false, block: 'clock-invalid' });
  });

  it('blocks rollback unless an explicit recovery path authorises it', () => {
    expect(
      decideDatasetActivation({
        allowRecoveryRollback: false,
        candidate: generation(1),
        current: generation(2),
        now,
      }),
    ).toEqual({ allowed: false, block: 'rollback-not-authorised' });
    expect(
      decideDatasetActivation({
        allowRecoveryRollback: true,
        candidate: generation(1),
        current: generation(2),
        now,
      }),
    ).toEqual({ allowed: true, replacesSequence: 2 });
  });

  it('rejects path traversal and duplicate manifest files', () => {
    const base = manifest(1);
    expect(() =>
      datasetManifestSchema.parse({
        ...base,
        files: [{ ...base.files[0], path: '../escape.sqlite' }],
      }),
    ).toThrow();
    expect(() =>
      datasetManifestSchema.parse({ ...base, files: [base.files[0], base.files[0]] }),
    ).toThrow();
  });
});
