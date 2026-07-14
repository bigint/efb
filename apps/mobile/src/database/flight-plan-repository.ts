import { savedFlightPlanSchema, type SavedFlightPlan } from '@driftline/aviation-domain';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface FlightRow {
  readonly aircraft_id: string | null;
  readonly altitude_feet: number | null;
  readonly created_at: string;
  readonly departure_time: string | null;
  readonly id: string;
  readonly notes: string;
  readonly revision: number;
  readonly status: 'active' | 'archived' | 'draft';
  readonly title: string;
  readonly updated_at: string;
}

export interface FlightWaypointRow {
  readonly flight_id: string;
  readonly identifier: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sequence: number;
  readonly source_ref: string;
}

export const decodeSavedFlightPlans = (
  rows: readonly FlightRow[],
  waypointRows: readonly FlightWaypointRow[],
): readonly SavedFlightPlan[] => {
  const byFlight = new Map<string, FlightWaypointRow[]>();
  for (const waypoint of waypointRows) {
    const current = byFlight.get(waypoint.flight_id) ?? [];
    current.push(waypoint);
    byFlight.set(waypoint.flight_id, current);
  }
  const knownIds = new Set(rows.map(({ id }) => id));
  if (waypointRows.some(({ flight_id }) => !knownIds.has(flight_id))) {
    throw new Error('Stored waypoint has no loaded flight owner.');
  }
  return rows.map((row) =>
    savedFlightPlanSchema.parse({
      aircraftId: row.aircraft_id,
      altitudeFeet: row.altitude_feet,
      createdAt: row.created_at,
      departureTime: row.departure_time,
      id: row.id,
      notes: row.notes,
      revision: row.revision,
      status: row.status,
      title: row.title,
      updatedAt: row.updated_at,
      waypoints: [...(byFlight.get(row.id) ?? [])]
        .sort((left, right) => left.sequence - right.sequence)
        .map((waypoint) => ({
          identifier: waypoint.identifier,
          latitude: waypoint.latitude,
          longitude: waypoint.longitude,
          sequence: waypoint.sequence,
          sourceRef: waypoint.source_ref,
        })),
    }),
  );
};

export const listSavedFlightPlans = async (
  database: SQLiteDatabase,
): Promise<readonly SavedFlightPlan[]> => {
  const [rows, waypointRows] = await Promise.all([
    database.getAllAsync<FlightRow>(
      `SELECT * FROM flights WHERE status <> 'archived' ORDER BY updated_at DESC LIMIT 101`,
    ),
    database.getAllAsync<FlightWaypointRow>(
      `SELECT waypoint.*
       FROM flight_waypoints AS waypoint
       JOIN flights AS flight ON flight.id = waypoint.flight_id
       WHERE flight.status <> 'archived'
       ORDER BY waypoint.flight_id, waypoint.sequence
       LIMIT 10000`,
    ),
  ]);
  if (rows.length > 100 || waypointRows.length > 10_000) {
    throw new Error('Saved flight collection exceeds supported limits.');
  }
  return decodeSavedFlightPlans(rows, waypointRows);
};

const insertWaypoints = async (
  database: SQLiteDatabase,
  plan: SavedFlightPlan,
): Promise<void> => {
  for (const waypoint of plan.waypoints) {
    await database.runAsync(
      `INSERT INTO flight_waypoints (
        flight_id, sequence, identifier, latitude, longitude, source_ref
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      plan.id,
      waypoint.sequence,
      waypoint.identifier,
      waypoint.latitude,
      waypoint.longitude,
      waypoint.sourceRef,
    );
  }
};

export const insertSavedFlightPlan = async (
  database: SQLiteDatabase,
  source: SavedFlightPlan,
): Promise<void> => {
  const plan = savedFlightPlanSchema.parse(source);
  if (plan.revision !== 1) throw new Error('A new saved flight must begin at revision one.');
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO flights (
        id, created_at, updated_at, title, departure_time, altitude_feet,
        aircraft_id, notes, revision, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      plan.id,
      plan.createdAt,
      plan.updatedAt,
      plan.title,
      plan.departureTime,
      plan.altitudeFeet,
      plan.aircraftId,
      plan.notes,
      plan.revision,
      plan.status,
    );
    await insertWaypoints(transaction, plan);
  });
};

export const replaceSavedFlightPlan = async (
  database: SQLiteDatabase,
  expectedRevision: number,
  source: SavedFlightPlan,
): Promise<void> => {
  const plan = savedFlightPlanSchema.parse(source);
  if (!Number.isInteger(expectedRevision) || plan.revision !== expectedRevision + 1) {
    throw new Error('Saved flight revision transition is invalid.');
  }
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE flights SET
        updated_at = ?, title = ?, departure_time = ?, altitude_feet = ?, aircraft_id = ?,
        notes = ?, revision = ?, status = ?
       WHERE id = ? AND revision = ?`,
      plan.updatedAt,
      plan.title,
      plan.departureTime,
      plan.altitudeFeet,
      plan.aircraftId,
      plan.notes,
      plan.revision,
      plan.status,
      plan.id,
      expectedRevision,
    );
    if (result.changes !== 1) throw new Error('Saved flight changed on another writer.');
    await transaction.runAsync(`DELETE FROM flight_waypoints WHERE flight_id = ?`, plan.id);
    await insertWaypoints(transaction, plan);
  });
};
