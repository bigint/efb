import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

const airportFavouriteSchema = z
  .object({
    createdAt: z.iso.datetime(),
    identifier: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,16}$/u),
  })
  .strict();

interface AirportFavouriteRow {
  readonly created_at: string;
  readonly identifier: string;
}

export const decodeAirportFavourites = (
  rows: readonly AirportFavouriteRow[],
): readonly string[] => {
  if (rows.length > 100) {
    throw new Error('Airport favourite collection exceeds supported limits');
  }
  const identifiers = rows.map((row) =>
    airportFavouriteSchema.parse({ createdAt: row.created_at, identifier: row.identifier }),
  );
  if (new Set(identifiers.map(({ identifier }) => identifier)).size !== identifiers.length) {
    throw new Error('Airport favourite identifiers must be unique');
  }
  return identifiers.map(({ identifier }) => identifier);
};

export const listAirportFavourites = async (
  database: SQLiteDatabase,
): Promise<readonly string[]> => {
  const rows = await database.getAllAsync<AirportFavouriteRow>(
    `SELECT identifier, created_at FROM airport_favourites
     ORDER BY created_at DESC, identifier
     LIMIT 101`,
  );
  if (rows.length > 100)
    throw new Error('Airport favourite collection exceeds supported limits');
  return decodeAirportFavourites(rows);
};

export const setAirportFavourite = async (
  database: SQLiteDatabase,
  identifier: string,
  favourite: boolean,
  changedAt: string,
): Promise<void> => {
  const value = airportFavouriteSchema.parse({ createdAt: changedAt, identifier });
  if (favourite) {
    await database.runAsync(
      `INSERT INTO airport_favourites (identifier, created_at) VALUES (?, ?)
       ON CONFLICT(identifier) DO NOTHING`,
      value.identifier,
      value.createdAt,
    );
  } else {
    await database.runAsync(
      `DELETE FROM airport_favourites WHERE identifier = ?`,
      value.identifier,
    );
  }
};
