import { aircraftProfileSchema, type AircraftProfile } from '@driftline/aircraft-performance';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface AircraftProfileRow {
  readonly created_at: string;
  readonly display_name: string;
  readonly id: string;
  readonly notes: string;
  readonly performance_json: string;
  readonly registration: string;
  readonly revision: number;
  readonly source: 'user-entered';
  readonly type_designator: string;
  readonly units_json: string;
  readonly updated_at: string;
  readonly verification_status: 'unverified';
}

const parseJson = (source: string, label: string): unknown => {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error(`Stored aircraft ${label} is not valid JSON.`);
  }
};

export const decodeAircraftProfileRows = (
  rows: readonly AircraftProfileRow[],
): readonly AircraftProfile[] =>
  rows.map((row) =>
    aircraftProfileSchema.parse({
      createdAt: row.created_at,
      displayName: row.display_name,
      id: row.id,
      notes: row.notes,
      planning: parseJson(row.performance_json, 'planning data'),
      registration: row.registration,
      revision: row.revision,
      source: row.source,
      typeDesignator: row.type_designator,
      units: parseJson(row.units_json, 'units'),
      updatedAt: row.updated_at,
      verificationStatus: row.verification_status,
    }),
  );

export const listAircraftProfiles = async (
  database: SQLiteDatabase,
): Promise<readonly AircraftProfile[]> => {
  const rows = await database.getAllAsync<AircraftProfileRow>(
    `SELECT
      id, created_at, updated_at, registration, type_designator, display_name,
      units_json, performance_json, notes, source, verification_status, revision
     FROM aircraft_profiles
     WHERE deleted_at IS NULL
     ORDER BY display_name, registration
     LIMIT 101`,
  );
  if (rows.length > 100)
    throw new Error('Aircraft profile collection exceeds supported limits.');
  return decodeAircraftProfileRows(rows);
};

export const insertAircraftProfile = async (
  database: SQLiteDatabase,
  source: AircraftProfile,
): Promise<void> => {
  const profile = aircraftProfileSchema.parse(source);
  await database.runAsync(
    `INSERT INTO aircraft_profiles (
      id, created_at, updated_at, registration, type_designator, display_name,
      units_json, performance_json, notes, source, verification_status, revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    profile.id,
    profile.createdAt,
    profile.updatedAt,
    profile.registration,
    profile.typeDesignator,
    profile.displayName,
    JSON.stringify(profile.units),
    JSON.stringify(profile.planning),
    profile.notes,
    profile.source,
    profile.verificationStatus,
    profile.revision,
  );
};

export const replaceAircraftProfile = async (
  database: SQLiteDatabase,
  expectedRevision: number,
  source: AircraftProfile,
): Promise<void> => {
  const profile = aircraftProfileSchema.parse(source);
  if (!Number.isInteger(expectedRevision) || profile.revision !== expectedRevision + 1) {
    throw new Error('Aircraft profile revision transition is invalid.');
  }
  const result = await database.runAsync(
    `UPDATE aircraft_profiles SET
      updated_at = ?, registration = ?, type_designator = ?, display_name = ?,
      units_json = ?, performance_json = ?, notes = ?, revision = ?
     WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
    profile.updatedAt,
    profile.registration,
    profile.typeDesignator,
    profile.displayName,
    JSON.stringify(profile.units),
    JSON.stringify(profile.planning),
    profile.notes,
    profile.revision,
    profile.id,
    expectedRevision,
  );
  if (result.changes !== 1) throw new Error('Aircraft profile changed on another writer.');
};
