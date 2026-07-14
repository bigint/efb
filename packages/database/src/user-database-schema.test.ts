import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import {
  buildUserDatabaseMigrationPlan,
  USER_DATABASE_VERSION,
  userDatabaseMigrations,
} from './user-database-schema';

describe('user database migration plan', () => {
  it('keeps migration versions contiguous and aligned with the schema version', () => {
    expect(userDatabaseMigrations.map(({ version }) => version)).toEqual(
      Array.from({ length: USER_DATABASE_VERSION }, (_, index) => index + 1),
    );
  });

  it('plans every migration for an empty database', () => {
    expect(buildUserDatabaseMigrationPlan(0)).toEqual(userDatabaseMigrations);
  });

  it('does not rerun applied migrations', () => {
    expect(buildUserDatabaseMigrationPlan(USER_DATABASE_VERSION)).toEqual([]);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid current version %s',
    (version) => {
      expect(() => buildUserDatabaseMigrationPlan(version)).toThrow('non-negative integer');
    },
  );

  it('rejects databases created by a newer app', () => {
    expect(() => buildUserDatabaseMigrationPlan(USER_DATABASE_VERSION + 1)).toThrow(
      'newer app version',
    );
  });

  it('owns each durable user-data collection and its relational integrity', () => {
    const schema = userDatabaseMigrations.flatMap(({ statements }) => statements).join('\n');
    for (const table of [
      'aircraft_profiles',
      'flights',
      'flight_waypoints',
      'checklist_templates',
      'checklist_items',
      'checklist_runs',
      'checklist_completions',
      'documents',
      'document_bookmarks',
      'logbook_entries',
      'logbook_entry_attachments',
    ]) {
      expect(schema).toContain(`CREATE TABLE ${table}`);
    }
    expect(schema).toContain('ON DELETE CASCADE');
    expect(schema).toContain("CHECK (status IN ('draft', 'active', 'archived'))");
    expect(schema).not.toContain('dataset_generations');
  });

  it('applies cleanly to SQLite and enforces route ownership', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of userDatabaseMigrations) {
      database.exec('BEGIN IMMEDIATE');
      try {
        for (const statement of migration.statements) database.exec(statement);
        database.exec(`PRAGMA user_version = ${migration.version}`);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }

    const version = database.prepare('PRAGMA user_version').get() as {
      readonly user_version: number;
    };
    expect(version.user_version).toBe(USER_DATABASE_VERSION);
    expect(() =>
      database
        .prepare(
          `INSERT INTO flight_waypoints
            (flight_id, sequence, identifier, latitude, longitude, source_ref)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('missing-flight', 0, 'TEST', 0, 0, 'test-fixture'),
    ).toThrow(/FOREIGN KEY constraint failed/u);
    database.close();
  });

  it('preserves v1 logbook rows while moving dataset authority out of the user database', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    const first = userDatabaseMigrations[0];
    const second = userDatabaseMigrations[1];
    if (first === undefined || second === undefined)
      throw new Error('Missing migration fixture');
    for (const statement of first.statements) database.exec(statement);
    database
      .prepare(
        `INSERT INTO logbook_entries (
          id, created_at, updated_at, flight_date, jurisdiction, aircraft_registration,
          departure_identifier, arrival_identifier, block_minutes, flight_minutes,
          pic_minutes, sic_minutes, night_minutes, instrument_minutes, approaches,
          landings_day, landings_night, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        '2026-07-14T10:00:00.000Z',
        '2026-07-14T10:00:00.000Z',
        '2026-07-14',
        'UNCLASSIFIED',
        'N123DL',
        'KPDX',
        'KSEA',
        90,
        75,
        75,
        0,
        15,
        10,
        1,
        1,
        0,
        'v1 fixture',
      );
    for (const statement of second.statements) database.exec(statement);

    expect(
      database
        .prepare(
          `SELECT day_minutes, dual_minutes, instructor_minutes, compliance_status
           FROM logbook_entries`,
        )
        .get(),
    ).toEqual({
      compliance_status: 'not-evaluated',
      day_minutes: 60,
      dual_minutes: 0,
      instructor_minutes: 0,
    });
    expect(
      database
        .prepare(
          `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'offline_regions'`,
        )
        .get(),
    ).toBeUndefined();
    database.close();
  });
});
