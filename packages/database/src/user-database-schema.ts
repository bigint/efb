export const USER_DATABASE_VERSION = 3;

export interface UserDatabaseMigration {
  readonly statements: readonly string[];
  readonly version: number;
}

export const userDatabaseMigrations: readonly UserDatabaseMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE aircraft_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        registration TEXT NOT NULL,
        type_designator TEXT NOT NULL,
        display_name TEXT NOT NULL,
        units_json TEXT NOT NULL,
        performance_json TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        deleted_at TEXT
      ) STRICT`,
      `CREATE INDEX aircraft_profiles_registration_idx
        ON aircraft_profiles (registration)`,
      `CREATE TABLE flights (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT NOT NULL,
        departure_time TEXT,
        altitude_feet INTEGER CHECK (altitude_feet IS NULL OR altitude_feet >= 0),
        aircraft_id TEXT REFERENCES aircraft_profiles(id) ON DELETE SET NULL,
        notes TEXT NOT NULL DEFAULT '',
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived'))
      ) STRICT`,
      `CREATE INDEX flights_updated_at_idx ON flights (updated_at DESC)`,
      `CREATE TABLE flight_waypoints (
        flight_id TEXT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL CHECK (sequence >= 0),
        identifier TEXT NOT NULL,
        latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
        longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
        source_ref TEXT NOT NULL,
        PRIMARY KEY (flight_id, sequence)
      ) STRICT, WITHOUT ROWID`,
      `CREATE TABLE checklist_templates (
        id TEXT PRIMARY KEY NOT NULL,
        aircraft_id TEXT REFERENCES aircraft_profiles(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT NOT NULL,
        phase TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        deleted_at TEXT
      ) STRICT`,
      `CREATE TABLE checklist_items (
        template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL CHECK (sequence >= 0),
        challenge TEXT NOT NULL,
        response TEXT NOT NULL,
        is_critical INTEGER NOT NULL DEFAULT 0 CHECK (is_critical IN (0, 1)),
        PRIMARY KEY (template_id, sequence)
      ) STRICT, WITHOUT ROWID`,
      `CREATE TABLE checklist_runs (
        id TEXT PRIMARY KEY NOT NULL,
        template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE RESTRICT,
        flight_id TEXT REFERENCES flights(id) ON DELETE SET NULL,
        template_revision INTEGER NOT NULL CHECK (template_revision >= 1),
        started_at TEXT NOT NULL,
        completed_at TEXT
      ) STRICT`,
      `CREATE TABLE checklist_completions (
        run_id TEXT NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
        item_sequence INTEGER NOT NULL CHECK (item_sequence >= 0),
        completed_at TEXT NOT NULL,
        PRIMARY KEY (run_id, item_sequence)
      ) STRICT, WITHOUT ROWID`,
      `CREATE TABLE documents (
        id TEXT PRIMARY KEY NOT NULL,
        imported_at TEXT NOT NULL,
        display_name TEXT NOT NULL,
        local_uri TEXT NOT NULL UNIQUE,
        sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
        byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
        mime_type TEXT NOT NULL CHECK (mime_type = 'application/pdf'),
        source TEXT NOT NULL CHECK (source = 'user-imported'),
        deleted_at TEXT
      ) STRICT`,
      `CREATE TABLE document_bookmarks (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page_index INTEGER NOT NULL CHECK (page_index >= 0),
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (document_id, page_index, label)
      ) STRICT, WITHOUT ROWID`,
      `CREATE TABLE logbook_entries (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        flight_date TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        aircraft_id TEXT REFERENCES aircraft_profiles(id) ON DELETE SET NULL,
        aircraft_registration TEXT NOT NULL,
        departure_identifier TEXT NOT NULL,
        arrival_identifier TEXT NOT NULL,
        block_minutes INTEGER NOT NULL CHECK (block_minutes >= 0),
        flight_minutes INTEGER NOT NULL CHECK (flight_minutes >= 0),
        pic_minutes INTEGER NOT NULL DEFAULT 0 CHECK (pic_minutes >= 0),
        sic_minutes INTEGER NOT NULL DEFAULT 0 CHECK (sic_minutes >= 0),
        night_minutes INTEGER NOT NULL DEFAULT 0 CHECK (night_minutes >= 0),
        instrument_minutes INTEGER NOT NULL DEFAULT 0 CHECK (instrument_minutes >= 0),
        approaches INTEGER NOT NULL DEFAULT 0 CHECK (approaches >= 0),
        landings_day INTEGER NOT NULL DEFAULT 0 CHECK (landings_day >= 0),
        landings_night INTEGER NOT NULL DEFAULT 0 CHECK (landings_night >= 0),
        remarks TEXT NOT NULL DEFAULT '',
        CHECK (flight_minutes <= block_minutes),
        CHECK (pic_minutes + sic_minutes <= flight_minutes),
        CHECK (night_minutes <= flight_minutes),
        CHECK (instrument_minutes <= flight_minutes)
      ) STRICT`,
      `CREATE INDEX logbook_entries_flight_date_idx
        ON logbook_entries (flight_date DESC)`,
      `CREATE TABLE offline_regions (
        region_id TEXT PRIMARY KEY NOT NULL,
        jurisdiction TEXT NOT NULL,
        active_dataset_id TEXT,
        state TEXT NOT NULL CHECK (state IN ('absent', 'downloading', 'ready', 'failed', 'expired')),
        byte_length INTEGER NOT NULL DEFAULT 0 CHECK (byte_length >= 0),
        last_checked_at TEXT
      ) STRICT`,
    ],
  },
  {
    version: 2,
    statements: [
      `ALTER TABLE logbook_entries RENAME TO logbook_entries_v1`,
      `CREATE TABLE logbook_entries (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        flight_date TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        aircraft_id TEXT REFERENCES aircraft_profiles(id) ON DELETE SET NULL,
        aircraft_registration TEXT NOT NULL,
        departure_identifier TEXT NOT NULL,
        arrival_identifier TEXT NOT NULL,
        block_minutes INTEGER NOT NULL CHECK (block_minutes >= 0),
        flight_minutes INTEGER NOT NULL CHECK (flight_minutes >= 0),
        day_minutes INTEGER NOT NULL DEFAULT 0 CHECK (day_minutes >= 0),
        pic_minutes INTEGER NOT NULL DEFAULT 0 CHECK (pic_minutes >= 0),
        sic_minutes INTEGER NOT NULL DEFAULT 0 CHECK (sic_minutes >= 0),
        dual_minutes INTEGER NOT NULL DEFAULT 0 CHECK (dual_minutes >= 0),
        instructor_minutes INTEGER NOT NULL DEFAULT 0 CHECK (instructor_minutes >= 0),
        night_minutes INTEGER NOT NULL DEFAULT 0 CHECK (night_minutes >= 0),
        instrument_minutes INTEGER NOT NULL DEFAULT 0 CHECK (instrument_minutes >= 0),
        approaches INTEGER NOT NULL DEFAULT 0 CHECK (approaches >= 0),
        landings_day INTEGER NOT NULL DEFAULT 0 CHECK (landings_day >= 0),
        landings_night INTEGER NOT NULL DEFAULT 0 CHECK (landings_night >= 0),
        remarks TEXT NOT NULL DEFAULT '',
        compliance_status TEXT NOT NULL CHECK (compliance_status = 'not-evaluated'),
        CHECK (flight_minutes <= block_minutes),
        CHECK (day_minutes + night_minutes <= flight_minutes),
        CHECK (pic_minutes + sic_minutes <= flight_minutes),
        CHECK (dual_minutes <= flight_minutes),
        CHECK (instructor_minutes <= flight_minutes),
        CHECK (night_minutes <= flight_minutes),
        CHECK (instrument_minutes <= flight_minutes)
      ) STRICT`,
      `INSERT INTO logbook_entries (
        id, created_at, updated_at, flight_date, jurisdiction, aircraft_id,
        aircraft_registration, departure_identifier, arrival_identifier, block_minutes,
        flight_minutes, day_minutes, pic_minutes, sic_minutes, dual_minutes,
        instructor_minutes, night_minutes, instrument_minutes, approaches,
        landings_day, landings_night, remarks, compliance_status
      )
      SELECT
        id, created_at, updated_at, flight_date, jurisdiction, aircraft_id,
        aircraft_registration, departure_identifier, arrival_identifier, block_minutes,
        flight_minutes, flight_minutes - night_minutes, pic_minutes, sic_minutes, 0,
        0, night_minutes, instrument_minutes, approaches,
        landings_day, landings_night, remarks, 'not-evaluated'
      FROM logbook_entries_v1`,
      `DROP TABLE logbook_entries_v1`,
      `CREATE INDEX logbook_entries_flight_date_idx
        ON logbook_entries (flight_date DESC)`,
      `CREATE TABLE logbook_entry_attachments (
        entry_id TEXT NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (entry_id, document_id)
      ) STRICT, WITHOUT ROWID`,
      `DROP TABLE IF EXISTS offline_regions`,
    ],
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE checklist_templates ADD COLUMN category TEXT NOT NULL DEFAULT 'normal'
        CHECK (category IN ('normal', 'abnormal', 'emergency'))`,
      `ALTER TABLE checklist_templates ADD COLUMN source TEXT NOT NULL DEFAULT 'user-authored'
        CHECK (source IN ('user-authored', 'generic-demonstration'))`,
      `ALTER TABLE checklist_templates ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verification_status = 'unverified')`,
      `ALTER TABLE checklist_templates ADD COLUMN aircraft_label TEXT NOT NULL DEFAULT 'Unassigned aircraft'`,
      `UPDATE checklist_templates
        SET category = CASE lower(phase)
          WHEN 'abnormal' THEN 'abnormal'
          WHEN 'emergency' THEN 'emergency'
          ELSE 'normal'
        END`,
      `ALTER TABLE checklist_runs ADD COLUMN item_count INTEGER NOT NULL DEFAULT 0
        CHECK (item_count >= 0 AND item_count <= 100)`,
      `ALTER TABLE checklist_runs ADD COLUMN template_snapshot_json TEXT NOT NULL DEFAULT '{}'`,
      `ALTER TABLE checklist_runs ADD COLUMN state_revision INTEGER NOT NULL DEFAULT 1
        CHECK (state_revision >= 1)`,
      `UPDATE checklist_runs
        SET item_count = (
          SELECT count(*) FROM checklist_items
          WHERE checklist_items.template_id = checklist_runs.template_id
        )`,
      `UPDATE checklist_runs
        SET template_snapshot_json = (
          SELECT json_object(
            'aircraftId', template.aircraft_id,
            'aircraftLabel', template.aircraft_label,
            'category', template.category,
            'createdAt', template.created_at,
            'id', template.id,
            'items', json(COALESCE((
              SELECT json_group_array(json(ordered.item_json))
              FROM (
                SELECT json_object(
                  'challenge', item.challenge,
                  'isCritical', CASE item.is_critical WHEN 1 THEN json('true') ELSE json('false') END,
                  'response', item.response,
                  'sequence', item.sequence
                ) AS item_json
                FROM checklist_items AS item
                WHERE item.template_id = template.id
                ORDER BY item.sequence
              ) AS ordered
            ), '[]')),
            'revision', template.revision,
            'source', template.source,
            'title', template.title,
            'updatedAt', template.updated_at,
            'verificationStatus', template.verification_status
          )
          FROM checklist_templates AS template
          WHERE template.id = checklist_runs.template_id
        )`,
    ],
  },
] as const;

export const buildUserDatabaseMigrationPlan = (
  currentVersion: number,
): readonly UserDatabaseMigration[] => {
  if (!Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error('User database version must be a non-negative integer.');
  }
  if (currentVersion > USER_DATABASE_VERSION) {
    throw new Error('User database was created by a newer app version.');
  }

  return userDatabaseMigrations.filter(({ version }) => version > currentVersion);
};
