import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn() }));

import {
  decodeOfflineRegistry,
  queryOfflineRegistry,
  type ActiveGenerationRow,
  type DatasetFileRow,
  type DownloadAttemptRow,
} from './offline-registry-repository';

const datasetId = '019f5f42-a146-7c00-861d-7ad2313bbbd4';
const fileSha = 'b'.repeat(64);
const manifest = {
  datasetId,
  effectiveAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-08-01T00:00:00.000Z',
  files: [
    {
      byteLength: 1_024,
      mediaType: 'application/octet-stream',
      path: 'airports.bin',
      sha256: fileSha,
    },
  ],
  formatVersion: 1,
  generatedAt: '2026-06-25T00:00:00.000Z',
  jurisdiction: 'US-DEMO',
  regionId: 'us-demo-west',
  sequence: 1,
  source: 'Test fixture',
  sourceVersion: 'fixture-1',
} as const;

const generationRow = (): ActiveGenerationRow => ({
  activated_at: '2026-07-14T12:00:00.000Z',
  active_dataset_id: datasetId,
  dataset_id: datasetId,
  integrity_checked_at: '2026-07-14T11:01:00.000Z',
  jurisdiction: manifest.jurisdiction,
  manifest_digest: 'a'.repeat(64),
  manifest_json: JSON.stringify(manifest),
  mapping_jurisdiction: manifest.jurisdiction,
  mapping_region_id: manifest.regionId,
  prior_dataset_id: null,
  region_id: manifest.regionId,
  sequence: 1,
  signature_key_id: 'test-key',
  signature_verified_at: '2026-07-14T11:00:00.000Z',
  state: 'active',
  updated_at: '2026-07-14T12:00:00.000Z',
});

const fileRow = (): DatasetFileRow => ({
  byte_length: 1_024,
  dataset_id: datasetId,
  integrity_checked_at: '2026-07-14T11:01:00.000Z',
  local_uri: 'file:///private/demo/airports.bin',
  media_type: 'application/octet-stream',
  path: 'airports.bin',
  sha256: fileSha,
});

const attemptRow = (): DownloadAttemptRow => ({
  attempt_id: 'attempt-1',
  candidate_dataset_id: datasetId,
  expected_bytes: 1_024,
  failure_code: null,
  jurisdiction: manifest.jurisdiction,
  received_bytes: 1_024,
  region_id: manifest.regionId,
  started_at: '2026-07-14T10:00:00.000Z',
  status: 'completed',
  updated_at: '2026-07-14T12:00:00.000Z',
});

describe('offline registry SQLite read boundary', () => {
  it('cross-checks active pointers, manifest files, and attempts', () => {
    expect(
      decodeOfflineRegistry(
        [generationRow()],
        [fileRow()],
        [attemptRow()],
        new Date('2026-07-14T13:00:00.000Z'),
      ),
    ).toMatchObject({
      activePackages: [
        { availability: 'current', fileCount: 1, sequence: 1, totalBytes: 1_024 },
      ],
      attempts: [{ status: 'completed' }],
      filesystemVerified: false,
    });
  });

  it('fails closed when an active pointer disagrees with the manifest', () => {
    expect(() =>
      decodeOfflineRegistry(
        [{ ...generationRow(), mapping_region_id: 'other-region' }],
        [fileRow()],
        [],
        new Date('2026-07-14T13:00:00.000Z'),
      ),
    ).toThrow('do not agree');
  });

  it('fails closed on incomplete or out-of-scope file metadata', () => {
    expect(() =>
      decodeOfflineRegistry(
        [generationRow()],
        [{ ...fileRow(), byte_length: 1_023 }],
        [],
        new Date('2026-07-14T13:00:00.000Z'),
      ),
    ).toThrow('does not match');
    expect(() =>
      decodeOfflineRegistry([], [fileRow()], [], new Date('2026-07-14T13:00:00.000Z')),
    ).toThrow('outside active');
  });

  it('rejects inconsistent transfer failure metadata', () => {
    expect(() =>
      decodeOfflineRegistry(
        [],
        [],
        [{ ...attemptRow(), failure_code: 'network-unavailable', status: 'completed' }],
        new Date('2026-07-14T13:00:00.000Z'),
      ),
    ).toThrow('inconsistent');
  });

  it('derives expiry from the verified generation without deleting it', () => {
    expect(
      decodeOfflineRegistry(
        [generationRow()],
        [fileRow()],
        [],
        new Date('2026-08-01T00:00:00.000Z'),
      ).activePackages[0]?.availability,
    ).toBe('expired');
  });

  it('queries pointers, files, and attempts in one exclusive snapshot', async () => {
    let transactionCount = 0;
    const database = {
      getAllAsync: (sql: string) =>
        Promise.resolve(
          sql.includes('active_region_generations AS active') && sql.includes('generation.*')
            ? [generationRow()]
            : sql.includes('dataset_files')
              ? [fileRow()]
              : [attemptRow()],
        ),
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) => {
        transactionCount += 1;
        return operation(database);
      },
    };
    await expect(
      queryOfflineRegistry(database as never, new Date('2026-07-14T13:00:00.000Z')),
    ).resolves.toMatchObject({
      activePackages: [{ datasetId }],
      attempts: [{ status: 'completed' }],
    });
    expect(transactionCount).toBe(1);
  });
});
