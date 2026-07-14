import { describe, expect, it } from 'vitest';

import {
  decodeSavedFlightPlans,
  loadSavedFlightPlanLibrary,
  listSavedFlightPlans,
  type FlightRow,
  type FlightWaypointRow,
} from './flight-plan-repository';

const flight: FlightRow = {
  aircraft_id: null,
  altitude_feet: null,
  created_at: '2026-07-14T10:00:00.000Z',
  departure_time: null,
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  notes: '',
  revision: 1,
  status: 'draft',
  title: 'Saved demo',
  updated_at: '2026-07-14T10:00:00.000Z',
};

const waypoint = (sequence: number, identifier: string): FlightWaypointRow => ({
  flight_id: flight.id,
  identifier,
  latitude: 12 + sequence,
  longitude: 77 + sequence,
  sequence,
  source_ref: `demo:${identifier}`,
});

describe('saved flight SQLite read boundary', () => {
  it('sorts relational waypoints and validates the reconstructed plan', () => {
    expect(
      decodeSavedFlightPlans(
        [flight],
        [waypoint(1, 'DVL2'), waypoint(0, 'DVL1')],
      )[0]?.waypoints.map(({ identifier }) => identifier),
    ).toEqual(['DVL1', 'DVL2']);
  });

  it('fails closed on a sequence gap', () => {
    expect(() => decodeSavedFlightPlans([flight], [waypoint(1, 'DVL2')])).toThrow('contiguous');
  });

  it('fails closed when a waypoint owner is outside the loaded collection', () => {
    expect(() =>
      decodeSavedFlightPlans([], [{ ...waypoint(0, 'DVL1'), flight_id: 'missing' }]),
    ).toThrow('no loaded flight owner');
  });

  it('reconstructs rows and waypoints inside one exclusive read transaction', async () => {
    let transactionCount = 0;
    const database = {
      getAllAsync: (sql: string) =>
        Promise.resolve(
          sql.includes('FROM flights') ? [flight] : [waypoint(0, 'DVL1'), waypoint(1, 'DVL2')],
        ),
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) => {
        transactionCount += 1;
        return operation(database);
      },
    };
    await expect(listSavedFlightPlans(database as never)).resolves.toHaveLength(1);
    expect(transactionCount).toBe(1);
  });

  it('detects waypoint overflow with a limit sentinel row', async () => {
    const database = {
      getAllAsync: (sql: string) =>
        Promise.resolve(
          sql.includes('FROM flights')
            ? [flight]
            : Array.from({ length: 10_001 }, (_, sequence) =>
                waypoint(sequence, `P${sequence}`),
              ),
        ),
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    await expect(listSavedFlightPlans(database as never)).rejects.toThrow('supported limits');
  });

  it('splits active and archived plans only after one complete snapshot read', async () => {
    const archived = {
      ...flight,
      id: '019f5f42-a146-7c00-861d-7ad2313bbbd5',
      status: 'archived' as const,
      title: 'Archived demo',
    };
    const rows = [flight, archived];
    const waypoints = [
      waypoint(0, 'DVL1'),
      waypoint(1, 'DVL2'),
      { ...waypoint(0, 'DVL1'), flight_id: archived.id },
      { ...waypoint(1, 'DVL2'), flight_id: archived.id },
    ];
    let transactionCount = 0;
    const database = {
      getAllAsync: (sql: string) =>
        Promise.resolve(sql.includes('FROM flights') ? rows : waypoints),
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) => {
        transactionCount += 1;
        return operation(database);
      },
    };
    await expect(loadSavedFlightPlanLibrary(database as never)).resolves.toMatchObject({
      active: [{ id: flight.id }],
      archived: [{ id: archived.id }],
    });
    expect(transactionCount).toBe(1);
  });
});
