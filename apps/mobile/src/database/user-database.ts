import { buildUserDatabaseMigrationPlan, USER_DATABASE_VERSION } from '@driftline/database';
import type { SQLiteDatabase } from 'expo-sqlite';

export const USER_DATABASE_NAME = 'driftline-user-v1.db';

interface UserVersionRow {
  readonly user_version: number;
}

/**
 * Opens the user-owned database in a known state before any screen renders.
 * All executed SQL is application-owned migration text, never interpolated user input.
 */
export const initialiseUserDatabase = async (database: SQLiteDatabase): Promise<void> => {
  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');

  const row = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  if (row === null) throw new Error('Unable to read the user database version.');

  const migrations = buildUserDatabaseMigrationPlan(row.user_version);
  for (const migration of migrations) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const statement of migration.statements) {
        await transaction.execAsync(statement);
      }
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  const migrated = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  if (migrated?.user_version !== USER_DATABASE_VERSION) {
    throw new Error('User database migration did not reach the expected version.');
  }
};
