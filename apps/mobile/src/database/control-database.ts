import {
  buildControlDatabaseMigrationPlan,
  CONTROL_DATABASE_VERSION,
} from '@driftline/database';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const CONTROL_DATABASE_NAME = 'driftline-control-v1.db';

interface UserVersionRow {
  readonly user_version: number;
}

export const initialiseControlDatabase = async (database: SQLiteDatabase): Promise<void> => {
  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');

  const row = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  if (row === null) throw new Error('Unable to read the control database version.');

  for (const migration of buildControlDatabaseMigrationPlan(row.user_version)) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const statement of migration.statements) await transaction.execAsync(statement);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  const migrated = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  if (migrated?.user_version !== CONTROL_DATABASE_VERSION) {
    throw new Error('Control database migration did not reach the expected version.');
  }
};

export const initialiseControlDatabaseFile = async (): Promise<void> => {
  const database = await openDatabaseAsync(CONTROL_DATABASE_NAME);
  try {
    await initialiseControlDatabase(database);
  } finally {
    await database.closeAsync();
  }
};
