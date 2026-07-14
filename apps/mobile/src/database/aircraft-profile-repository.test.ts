import { describe, expect, it } from 'vitest';

import {
  decodeAircraftProfileRows,
  deleteAircraftProfile,
  type AircraftProfileRow,
} from './aircraft-profile-repository';

const row: AircraftProfileRow = {
  created_at: '2026-07-14T10:00:00.000Z',
  display_name: 'My trainer',
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  notes: '',
  performance_json: JSON.stringify({
    cruiseSpeedKt: 118,
    emptyArmM: 0.9,
    emptyMassKg: 700,
    fuelArmM: 1,
    fuelBurnLitresPerHour: 32,
    maximumMassKg: 1_200,
    occupantArmM: 1.2,
    usableFuelLitres: 180,
  }),
  registration: 'N123DL',
  revision: 1,
  source: 'user-entered',
  type_designator: 'DEMO',
  units_json: JSON.stringify({ arm: 'm', fuel: 'l', mass: 'kg', speed: 'kt' }),
  updated_at: '2026-07-14T10:00:00.000Z',
  verification_status: 'unverified',
};

describe('aircraft profile SQLite read boundary', () => {
  it('decodes and validates stored profiles', () => {
    expect(decodeAircraftProfileRows([row])).toMatchObject([
      { displayName: 'My trainer', registration: 'N123DL', revision: 1 },
    ]);
  });

  it('fails closed on malformed planning JSON', () => {
    expect(() => decodeAircraftProfileRows([{ ...row, performance_json: '{broken' }])).toThrow(
      'planning data',
    );
  });

  it('fails closed on unsupported persisted units', () => {
    expect(() =>
      decodeAircraftProfileRows([
        { ...row, units_json: JSON.stringify({ arm: 'in', fuel: 'gal', mass: 'lb' }) },
      ]),
    ).toThrow();
    expect(() => decodeAircraftProfileRows([row, row])).toThrow('duplicates');
  });

  it('deletes an unreferenced current revision inside one exclusive transaction', async () => {
    const statements: string[] = [];
    const database = {
      getFirstAsync: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ reference_count: 0 });
      },
      runAsync: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ changes: 1 });
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    const profile = decodeAircraftProfileRows([row])[0];
    if (profile === undefined) throw new Error('Expected profile fixture');
    await deleteAircraftProfile(database as never, profile);
    expect(statements[0]).toContain('checklist_templates');
    expect(statements[1]).toContain('revision = ?');
  });

  it('blocks deletion before writing when durable records reference the profile', async () => {
    let writes = 0;
    const database = {
      getFirstAsync: () => Promise.resolve({ reference_count: 1 }),
      runAsync: () => {
        writes += 1;
        return Promise.resolve({ changes: 1 });
      },
      withExclusiveTransactionAsync: (operation: (transaction: unknown) => Promise<void>) =>
        operation(database),
    };
    const profile = decodeAircraftProfileRows([row])[0];
    if (profile === undefined) throw new Error('Expected profile fixture');
    await expect(deleteAircraftProfile(database as never, profile)).rejects.toThrow(
      'referenced',
    );
    expect(writes).toBe(0);
  });
});
