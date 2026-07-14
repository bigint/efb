import { describe, expect, it } from 'vitest';

import {
  datasetManifestSchema,
  MAX_DATASET_FILE_COUNT,
  MAX_DATASET_TOTAL_BYTES,
} from './dataset-manifest';

const file = (path: string, byteLength = 1) => ({
  byteLength,
  mediaType: 'application/octet-stream',
  path,
  sha256: 'a'.repeat(64),
});

const manifest = (files: readonly ReturnType<typeof file>[]) => ({
  datasetId: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  effectiveAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-08-01T00:00:00.000Z',
  files,
  formatVersion: 1,
  generatedAt: '2026-06-25T00:00:00.000Z',
  jurisdiction: 'US-DEMO',
  regionId: 'us-demo-west',
  sequence: 1,
  source: 'Test fixture',
  sourceVersion: 'fixture-1',
});

describe('dataset manifest bounds', () => {
  it('accepts a bounded unique relative file manifest', () => {
    expect(datasetManifestSchema.parse(manifest([file('airports.bin')])).files).toHaveLength(1);
  });

  it('rejects aggregate packages above the transfer limit', () => {
    expect(() =>
      datasetManifestSchema.parse(
        manifest([file('one.bin', MAX_DATASET_TOTAL_BYTES), file('two.bin', 1)]),
      ),
    ).toThrow('aggregate size');
  });

  it('rejects an excessive file collection before activation', () => {
    expect(() =>
      datasetManifestSchema.parse(
        manifest(
          Array.from({ length: MAX_DATASET_FILE_COUNT + 1 }, (_, index) => file(`${index}`)),
        ),
      ),
    ).toThrow();
  });

  it('rejects duplicate and traversing paths', () => {
    expect(() => datasetManifestSchema.parse(manifest([file('same'), file('same')]))).toThrow(
      'unique',
    );
    expect(() => datasetManifestSchema.parse(manifest([file('../escape')]))).toThrow(
      'traverse',
    );
  });

  it('rejects unsafe or unbounded path and display metadata', () => {
    expect(() => datasetManifestSchema.parse(manifest([file('unsafe path')]))).toThrow(
      'unsupported characters',
    );
    expect(() =>
      datasetManifestSchema.parse({
        ...manifest([file('safe.bin')]),
        source: 'Unsafe\nsource',
      }),
    ).toThrow('control characters');
    expect(() =>
      datasetManifestSchema.parse({
        ...manifest([file('safe.bin')]),
        sourceVersion: 'x'.repeat(129),
      }),
    ).toThrow();
    expect(() =>
      datasetManifestSchema.parse(manifest([{ ...file('safe.bin'), mediaType: 'not a mime' }])),
    ).toThrow();
  });
});
