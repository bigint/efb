import {
  datasetManifestSchema,
  evaluateOfflineRegionAvailability,
  MAX_DATASET_FILE_COUNT,
  type OfflineRegionAvailability,
  type OfflineRegionState,
  type VerifiedDatasetGeneration,
} from '@driftline/database';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { CONTROL_DATABASE_NAME } from './control-database';

export interface ActiveGenerationRow {
  readonly activated_at: string | null;
  readonly active_dataset_id: string;
  readonly dataset_id: string;
  readonly integrity_checked_at: string;
  readonly jurisdiction: string;
  readonly manifest_digest: string;
  readonly manifest_json: string;
  readonly mapping_jurisdiction: string;
  readonly mapping_region_id: string;
  readonly prior_dataset_id: string | null;
  readonly region_id: string;
  readonly sequence: number;
  readonly signature_key_id: string;
  readonly signature_verified_at: string;
  readonly state: string;
  readonly updated_at: string;
}

export interface DatasetFileRow {
  readonly byte_length: number;
  readonly dataset_id: string;
  readonly integrity_checked_at: string;
  readonly local_uri: string;
  readonly media_type: string;
  readonly path: string;
  readonly sha256: string;
}

export interface DownloadAttemptRow {
  readonly attempt_id: string;
  readonly candidate_dataset_id: string | null;
  readonly expected_bytes: number;
  readonly failure_code: string | null;
  readonly jurisdiction: string;
  readonly received_bytes: number;
  readonly region_id: string;
  readonly started_at: string;
  readonly status: string;
  readonly updated_at: string;
}

export interface OfflinePackageStatus {
  readonly activatedAt: string;
  readonly availability: OfflineRegionAvailability['kind'];
  readonly datasetId: string;
  readonly expiresAt: string;
  readonly fileCount: number;
  readonly jurisdiction: string;
  readonly priorDatasetId: string | null;
  readonly regionId: string;
  readonly sequence: number;
  readonly source: string;
  readonly sourceVersion: string;
  readonly totalBytes: number;
}

export interface OfflineAttemptStatus {
  readonly attemptId: string;
  readonly candidateDatasetId: string | null;
  readonly expectedBytes: number;
  readonly failureCode: string | null;
  readonly jurisdiction: string;
  readonly receivedBytes: number;
  readonly regionId: string;
  readonly startedAt: string;
  readonly status: 'completed' | 'downloading' | 'failed' | 'staged' | 'verifying';
  readonly updatedAt: string;
}

export interface OfflineRegistrySnapshot {
  readonly activePackages: readonly OfflinePackageStatus[];
  readonly attempts: readonly OfflineAttemptStatus[];
  readonly filesystemVerified: false;
  readonly readAt: string;
}

const isoTime = (value: string, label: string): string => {
  if (!Number.isFinite(Date.parse(value)))
    throw new Error(`${label} is not a valid timestamp.`);
  return value;
};

const sha256 = (value: string, label: string): string => {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(`${label} is not a lowercase SHA-256.`);
  return value;
};

const decodeGeneration = (row: ActiveGenerationRow): VerifiedDatasetGeneration => {
  let manifestSource: unknown;
  try {
    manifestSource = JSON.parse(row.manifest_json) as unknown;
  } catch {
    throw new Error('Stored active dataset manifest is not valid JSON.');
  }
  const manifest = datasetManifestSchema.parse(manifestSource);
  if (
    row.active_dataset_id !== row.dataset_id ||
    row.dataset_id !== manifest.datasetId ||
    row.mapping_region_id !== row.region_id ||
    row.region_id !== manifest.regionId ||
    row.mapping_jurisdiction !== row.jurisdiction ||
    row.jurisdiction !== manifest.jurisdiction ||
    row.sequence !== manifest.sequence ||
    row.state !== 'active' ||
    row.activated_at === null
  ) {
    throw new Error('Active dataset pointer and manifest metadata do not agree.');
  }
  if (!/^[a-zA-Z0-9._:-]{1,128}$/u.test(row.signature_key_id)) {
    throw new Error('Signature key identifier is invalid.');
  }
  const signatureVerifiedAt = isoTime(row.signature_verified_at, 'Signature verification time');
  const integrityCheckedAt = isoTime(row.integrity_checked_at, 'Integrity check time');
  if (Date.parse(signatureVerifiedAt) > Date.parse(integrityCheckedAt)) {
    throw new Error('Dataset integrity predates signature verification.');
  }
  isoTime(row.updated_at, 'Active pointer update time');
  return {
    integrityCheckedAt,
    manifest,
    manifestDigest: sha256(row.manifest_digest, 'Manifest digest'),
    signatureKeyId: row.signature_key_id,
    signatureVerifiedAt,
  };
};

const decodeFiles = (
  generation: VerifiedDatasetGeneration,
  rows: readonly DatasetFileRow[],
): { readonly fileCount: number; readonly totalBytes: number } => {
  const relevant = rows.filter(
    ({ dataset_id }) => dataset_id === generation.manifest.datasetId,
  );
  if (relevant.length !== generation.manifest.files.length) {
    throw new Error('Active dataset file registry is incomplete.');
  }
  let totalBytes = 0;
  for (const expected of generation.manifest.files) {
    const stored = relevant.find(({ path }) => path === expected.path);
    if (
      stored === undefined ||
      stored.byte_length !== expected.byteLength ||
      stored.media_type !== expected.mediaType ||
      stored.sha256 !== expected.sha256 ||
      !stored.local_uri.startsWith('file://') ||
      stored.local_uri.includes('\0')
    ) {
      throw new Error('Active dataset file metadata does not match its manifest.');
    }
    const fileCheckedAt = isoTime(stored.integrity_checked_at, 'File integrity check time');
    if (Date.parse(fileCheckedAt) > Date.parse(generation.integrityCheckedAt)) {
      throw new Error('Dataset generation integrity predates a file integrity check.');
    }
    if (!Number.isSafeInteger(stored.byte_length) || stored.byte_length < 0) {
      throw new Error('Active dataset file length is invalid.');
    }
    totalBytes += stored.byte_length;
    if (!Number.isSafeInteger(totalBytes)) throw new Error('Active dataset size is unsafe.');
  }
  return { fileCount: relevant.length, totalBytes };
};

const attemptStatuses = new Set<OfflineAttemptStatus['status']>([
  'completed',
  'downloading',
  'failed',
  'staged',
  'verifying',
]);

const decodeAttempt = (row: DownloadAttemptRow): OfflineAttemptStatus => {
  if (!attemptStatuses.has(row.status as OfflineAttemptStatus['status'])) {
    throw new Error('Offline download attempt has an invalid status.');
  }
  if (
    !Number.isSafeInteger(row.expected_bytes) ||
    row.expected_bytes <= 0 ||
    !Number.isSafeInteger(row.received_bytes) ||
    row.received_bytes < 0 ||
    row.received_bytes > row.expected_bytes ||
    (row.status === 'failed') !== (row.failure_code !== null) ||
    (row.status === 'completed' && row.received_bytes !== row.expected_bytes) ||
    ((row.status === 'verifying' || row.status === 'staged') &&
      row.candidate_dataset_id === null) ||
    (row.failure_code !== null && !/^[a-z0-9-]{1,128}$/u.test(row.failure_code))
  ) {
    throw new Error('Offline download attempt metadata is inconsistent.');
  }
  const startedAt = isoTime(row.started_at, 'Download start time');
  const updatedAt = isoTime(row.updated_at, 'Download update time');
  if (Date.parse(updatedAt) < Date.parse(startedAt)) {
    throw new Error('Offline download attempt update predates its start.');
  }
  return {
    attemptId: row.attempt_id,
    candidateDatasetId: row.candidate_dataset_id,
    expectedBytes: row.expected_bytes,
    failureCode: row.failure_code,
    jurisdiction: row.jurisdiction,
    receivedBytes: row.received_bytes,
    regionId: row.region_id,
    startedAt,
    status: row.status as OfflineAttemptStatus['status'],
    updatedAt,
  };
};

export const decodeOfflineRegistry = (
  generationRows: readonly ActiveGenerationRow[],
  fileRows: readonly DatasetFileRow[],
  attemptRows: readonly DownloadAttemptRow[],
  now: Date,
): OfflineRegistrySnapshot => {
  if (!Number.isFinite(now.getTime())) throw new Error('Registry read time is invalid.');
  if (generationRows.length > 100 || fileRows.length > MAX_DATASET_FILE_COUNT) {
    throw new Error('Offline registry exceeds supported collection limits.');
  }
  const datasetIds = new Set<string>();
  const activePackages = generationRows.map((row) => {
    if (datasetIds.has(row.dataset_id))
      throw new Error('Active dataset pointers must be unique.');
    datasetIds.add(row.dataset_id);
    const generation = decodeGeneration(row);
    const files = decodeFiles(generation, fileRows);
    const activatedAt = isoTime(row.activated_at ?? '', 'Activation time');
    if (Date.parse(activatedAt) > now.getTime()) {
      throw new Error('Active dataset activation time is in the future.');
    }
    const state: OfflineRegionState = {
      active: {
        activatedAt,
        generation,
      },
      jurisdiction: row.jurisdiction,
      regionId: row.region_id,
      update: { kind: 'idle' },
    };
    return {
      activatedAt,
      availability: evaluateOfflineRegionAvailability(state, now).kind,
      datasetId: generation.manifest.datasetId,
      expiresAt: generation.manifest.expiresAt,
      fileCount: files.fileCount,
      jurisdiction: generation.manifest.jurisdiction,
      priorDatasetId: row.prior_dataset_id,
      regionId: generation.manifest.regionId,
      sequence: generation.manifest.sequence,
      source: generation.manifest.source,
      sourceVersion: generation.manifest.sourceVersion,
      totalBytes: files.totalBytes,
    };
  });
  const referencedFiles = new Set(activePackages.map(({ datasetId }) => datasetId));
  if (fileRows.some(({ dataset_id }) => !referencedFiles.has(dataset_id))) {
    throw new Error('Registry query returned files outside active generations.');
  }
  const attemptIds = new Set<string>();
  const attempts = attemptRows.map((row) => {
    if (attemptIds.has(row.attempt_id)) throw new Error('Download attempts must be unique.');
    attemptIds.add(row.attempt_id);
    return decodeAttempt(row);
  });
  return {
    activePackages,
    attempts,
    filesystemVerified: false,
    readAt: now.toISOString(),
  };
};

export const queryOfflineRegistry = async (
  database: SQLiteDatabase,
  now = new Date(),
): Promise<OfflineRegistrySnapshot> => {
  const result: { snapshot?: OfflineRegistrySnapshot } = {};
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const [generationRows, fileRows, attemptRows] = await Promise.all([
      transaction.getAllAsync<ActiveGenerationRow>(
        `SELECT
          active.region_id AS mapping_region_id,
          active.jurisdiction AS mapping_jurisdiction,
          active.active_dataset_id,
          active.prior_dataset_id,
          active.updated_at,
          generation.*
         FROM active_region_generations AS active
         JOIN dataset_generations AS generation
           ON generation.dataset_id = active.active_dataset_id
         ORDER BY active.region_id, active.jurisdiction
         LIMIT 101`,
      ),
      transaction.getAllAsync<DatasetFileRow>(
        `SELECT file.*
         FROM dataset_files AS file
         JOIN active_region_generations AS active
           ON active.active_dataset_id = file.dataset_id
         ORDER BY file.dataset_id, file.path
         LIMIT 10001`,
      ),
      transaction.getAllAsync<DownloadAttemptRow>(
        `SELECT * FROM dataset_download_attempts ORDER BY updated_at DESC LIMIT 25`,
      ),
    ]);
    result.snapshot = decodeOfflineRegistry(generationRows, fileRows, attemptRows, now);
  });
  if (result.snapshot === undefined) {
    throw new Error('Offline registry transaction produced no result.');
  }
  return result.snapshot;
};

export const readOfflineRegistry = async (): Promise<OfflineRegistrySnapshot> => {
  const database = await openDatabaseAsync(CONTROL_DATABASE_NAME);
  try {
    return await queryOfflineRegistry(database);
  } finally {
    await database.closeAsync();
  }
};
