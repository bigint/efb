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
      'airport_favourites',
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

  it('enforces one non-terminal checklist run after the abandonment migration', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of userDatabaseMigrations) {
      for (const statement of migration.statements) database.exec(statement);
    }
    database
      .prepare(
        `INSERT INTO checklist_templates (
          id, created_at, updated_at, title, phase, revision, category,
          source, verification_status, aircraft_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        '2026-07-14T10:00:00.000Z',
        '2026-07-14T10:00:00.000Z',
        'Fixture',
        'normal',
        1,
        'normal',
        'user-authored',
        'unverified',
        'N123DL',
      );
    const insertRun = database.prepare(
      `INSERT INTO checklist_runs (
        id, template_id, template_revision, started_at, item_count,
        template_snapshot_json, state_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertRun.run(
      '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      '019f5f42-a146-7c00-861d-7ad2313bbbd4',
      1,
      '2026-07-14T11:00:00.000Z',
      1,
      '{}',
      1,
    );
    expect(() =>
      insertRun.run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd6',
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        1,
        '2026-07-14T11:01:00.000Z',
        1,
        '{}',
        1,
      ),
    ).toThrow(/UNIQUE constraint failed/u);
    database
      .prepare(`UPDATE checklist_runs SET abandoned_at = ? WHERE id = ?`)
      .run('2026-07-14T11:02:00.000Z', '019f5f42-a146-7c00-861d-7ad2313bbbd5');
    expect(() =>
      insertRun.run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd6',
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        1,
        '2026-07-14T11:03:00.000Z',
        1,
        '{}',
        1,
      ),
    ).not.toThrow();
    database.close();
  });

  it('keeps airport favourites normalized and independent from dataset rows', () => {
    const database = new DatabaseSync(':memory:');
    for (const migration of userDatabaseMigrations) {
      for (const statement of migration.statements) database.exec(statement);
    }
    database
      .prepare(`INSERT INTO airport_favourites (identifier, created_at) VALUES (?, ?)`)
      .run('DVL1', '2026-07-14T10:00:00.000Z');
    expect(() =>
      database
        .prepare(`INSERT INTO airport_favourites (identifier, created_at) VALUES (?, ?)`)
        .run('dvl2', '2026-07-14T10:01:00.000Z'),
    ).toThrow(/CHECK constraint failed/u);
    expect(database.prepare(`SELECT identifier FROM airport_favourites`).all()).toEqual([
      { identifier: 'DVL1' },
    ]);
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

  it('upgrades legacy checklists with category and run snapshots', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    const first = userDatabaseMigrations[0];
    const second = userDatabaseMigrations[1];
    const third = userDatabaseMigrations[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Missing migration fixture');
    }
    for (const migration of [first, second]) {
      for (const statement of migration.statements) database.exec(statement);
    }
    database
      .prepare(
        `INSERT INTO checklist_templates
          (id, created_at, updated_at, title, phase, revision)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        '2026-07-14T10:00:00.000Z',
        '2026-07-14T10:00:00.000Z',
        'User fixture',
        'emergency',
        1,
      );
    database
      .prepare(
        `INSERT INTO checklist_items
          (template_id, sequence, challenge, response, is_critical)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('019f5f42-a146-7c00-861d-7ad2313bbbd4', 0, 'Test', 'Checked', 1);
    database
      .prepare(
        `INSERT INTO checklist_runs
          (id, template_id, template_revision, started_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd5',
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        1,
        '2026-07-14T11:00:00.000Z',
      );
    for (const statement of third.statements) database.exec(statement);

    const upgraded = database
      .prepare(
        `SELECT item_count, template_snapshot_json FROM checklist_runs
         WHERE id = ?`,
      )
      .get('019f5f42-a146-7c00-861d-7ad2313bbbd5') as {
      readonly item_count: number;
      readonly template_snapshot_json: string;
    };
    expect(upgraded.item_count).toBe(1);
    expect(JSON.parse(upgraded.template_snapshot_json)).toMatchObject({
      category: 'emergency',
      items: [{ challenge: 'Test', isCritical: true, sequence: 0 }],
      source: 'user-authored',
      verificationStatus: 'unverified',
    });
    database.close();
  });

  it('upgrades legacy document metadata into the app-private library', () => {
    const database = new DatabaseSync(':memory:');
    const migrations = userDatabaseMigrations.slice(0, 3);
    for (const migration of migrations) {
      for (const statement of migration.statements) database.exec(statement);
    }
    database
      .prepare(
        `INSERT INTO documents
          (id, imported_at, display_name, local_uri, sha256, byte_length, mime_type, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        '2026-07-14T10:00:00.000Z',
        'Legacy.pdf',
        'file:///documents/legacy.pdf',
        'a'.repeat(64),
        1024,
        'application/pdf',
        'user-imported',
      );
    const fourth = userDatabaseMigrations[3];
    if (fourth === undefined) throw new Error('Missing migration fixture');
    for (const statement of fourth.statements) database.exec(statement);
    expect(
      database
        .prepare(
          `SELECT storage_scope, folder, is_favourite, text_index_status
           FROM documents`,
        )
        .get(),
    ).toEqual({
      folder: 'Unfiled',
      is_favourite: 0,
      storage_scope: 'app-private',
      text_index_status: 'unavailable',
    });
    database.close();
  });

  it('upgrades legacy aircraft profiles with explicit unverified provenance', () => {
    const database = new DatabaseSync(':memory:');
    for (const migration of userDatabaseMigrations.slice(0, 4)) {
      for (const statement of migration.statements) database.exec(statement);
    }
    database
      .prepare(
        `INSERT INTO aircraft_profiles (
          id, created_at, updated_at, registration, type_designator, display_name,
          units_json, performance_json, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '019f5f42-a146-7c00-861d-7ad2313bbbd4',
        '2026-07-14T10:00:00.000Z',
        '2026-07-14T10:00:00.000Z',
        'N123DL',
        'DEMO',
        'Legacy aircraft',
        '{}',
        '{}',
        '',
      );
    const fifth = userDatabaseMigrations[4];
    if (fifth === undefined) throw new Error('Missing migration fixture');
    for (const statement of fifth.statements) database.exec(statement);
    expect(
      database
        .prepare(
          `SELECT source, verification_status, revision FROM aircraft_profiles WHERE id = ?`,
        )
        .get('019f5f42-a146-7c00-861d-7ad2313bbbd4'),
    ).toEqual({ revision: 1, source: 'user-entered', verification_status: 'unverified' });
    database.close();
  });
});
