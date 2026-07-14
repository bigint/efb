export const CONTROL_DATABASE_VERSION = 1;

export interface ControlDatabaseMigration {
  readonly statements: readonly string[];
  readonly version: number;
}

export const controlDatabaseMigrations: readonly ControlDatabaseMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE dataset_generations (
        dataset_id TEXT PRIMARY KEY NOT NULL,
        region_id TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK (sequence >= 1),
        manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
        manifest_json TEXT NOT NULL,
        signature_key_id TEXT NOT NULL,
        signature_verified_at TEXT NOT NULL,
        integrity_checked_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('staged', 'active', 'retained', 'quarantined')),
        activated_at TEXT,
        quarantined_at TEXT,
        quarantine_reason TEXT,
        UNIQUE (region_id, jurisdiction, sequence),
        CHECK (
          (state = 'quarantined' AND quarantined_at IS NOT NULL AND quarantine_reason IS NOT NULL)
          OR state <> 'quarantined'
        )
      ) STRICT`,
      `CREATE INDEX dataset_generations_region_state_idx
        ON dataset_generations (region_id, jurisdiction, state)`,
      `CREATE TABLE dataset_files (
        dataset_id TEXT NOT NULL REFERENCES dataset_generations(dataset_id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        media_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
        sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
        local_uri TEXT NOT NULL,
        integrity_checked_at TEXT NOT NULL,
        PRIMARY KEY (dataset_id, path)
      ) STRICT, WITHOUT ROWID`,
      `CREATE TABLE active_region_generations (
        region_id TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        active_dataset_id TEXT NOT NULL REFERENCES dataset_generations(dataset_id) ON DELETE RESTRICT,
        prior_dataset_id TEXT REFERENCES dataset_generations(dataset_id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (region_id, jurisdiction),
        CHECK (prior_dataset_id IS NULL OR prior_dataset_id <> active_dataset_id)
      ) STRICT, WITHOUT ROWID`,
      `CREATE TABLE dataset_download_attempts (
        attempt_id TEXT PRIMARY KEY NOT NULL,
        region_id TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        candidate_dataset_id TEXT,
        expected_bytes INTEGER NOT NULL CHECK (expected_bytes > 0),
        received_bytes INTEGER NOT NULL DEFAULT 0 CHECK (
          received_bytes >= 0 AND received_bytes <= expected_bytes
        ),
        status TEXT NOT NULL CHECK (
          status IN ('downloading', 'verifying', 'staged', 'failed', 'completed')
        ),
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        failure_code TEXT
      ) STRICT`,
      `CREATE INDEX dataset_download_attempts_region_idx
        ON dataset_download_attempts (region_id, jurisdiction, updated_at DESC)`,
    ],
  },
] as const;

export const buildControlDatabaseMigrationPlan = (
  currentVersion: number,
): readonly ControlDatabaseMigration[] => {
  if (!Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error('Control database version must be a non-negative integer.');
  }
  if (currentVersion > CONTROL_DATABASE_VERSION) {
    throw new Error('Control database was created by a newer app version.');
  }
  return controlDatabaseMigrations.filter(({ version }) => version > currentVersion);
};
