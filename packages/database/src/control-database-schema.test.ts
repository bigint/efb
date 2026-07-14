import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import {
  buildControlDatabaseMigrationPlan,
  CONTROL_DATABASE_VERSION,
  controlDatabaseMigrations,
} from './control-database-schema';

describe('control database migration plan', () => {
  it('keeps versions contiguous and refuses future schemas', () => {
    expect(controlDatabaseMigrations.map(({ version }) => version)).toEqual(
      Array.from({ length: CONTROL_DATABASE_VERSION }, (_, index) => index + 1),
    );
    expect(buildControlDatabaseMigrationPlan(0)).toEqual(controlDatabaseMigrations);
    expect(buildControlDatabaseMigrationPlan(CONTROL_DATABASE_VERSION)).toEqual([]);
    expect(() => buildControlDatabaseMigrationPlan(CONTROL_DATABASE_VERSION + 1)).toThrow(
      'newer app version',
    );
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid version %s',
    (version) => {
      expect(() => buildControlDatabaseMigrationPlan(version)).toThrow('non-negative integer');
    },
  );

  it('applies cleanly and prevents active pointers to unknown generations', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of controlDatabaseMigrations) {
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
    expect(version.user_version).toBe(CONTROL_DATABASE_VERSION);
    expect(() =>
      database
        .prepare(
          `INSERT INTO active_region_generations
            (region_id, jurisdiction, active_dataset_id, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run('test-region', 'US-DEMO', 'missing-dataset', '2026-07-14T00:00:00.000Z'),
    ).toThrow(/FOREIGN KEY constraint failed/u);
    database.close();
  });
});
