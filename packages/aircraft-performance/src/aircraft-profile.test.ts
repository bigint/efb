import { describe, expect, it } from 'vitest';

import { aircraftProfileSchema } from './aircraft-profile';

const fixture = () => ({
  createdAt: '2026-07-14T10:00:00.000Z',
  displayName: 'My trainer',
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  notes: '',
  planning: {
    cruiseSpeedKt: 118,
    emptyArmM: 0.9,
    emptyMassKg: 700,
    fuelArmM: 1,
    fuelBurnLitresPerHour: 32,
    maximumMassKg: 1_200,
    occupantArmM: 1.2,
    usableFuelLitres: 180,
  },
  registration: 'n123dl',
  revision: 1,
  source: 'user-entered',
  typeDesignator: 'demo',
  units: { arm: 'm', fuel: 'l', mass: 'kg', speed: 'kt' },
  updatedAt: '2026-07-14T10:00:00.000Z',
  verificationStatus: 'unverified',
});

describe('aircraft profile', () => {
  it('normalises identifiers while retaining explicit units and provenance', () => {
    expect(aircraftProfileSchema.parse(fixture())).toMatchObject({
      registration: 'N123DL',
      source: 'user-entered',
      typeDesignator: 'DEMO',
      verificationStatus: 'unverified',
    });
  });

  it('rejects maximum mass below empty mass', () => {
    const source = fixture();
    expect(() =>
      aircraftProfileSchema.parse({
        ...source,
        planning: { ...source.planning, maximumMassKg: 699 },
      }),
    ).toThrow('Maximum mass');
  });

  it('rejects implicit or unsupported unit systems', () => {
    expect(() =>
      aircraftProfileSchema.parse({ ...fixture(), units: { arm: 'in', mass: 'lb' } }),
    ).toThrow();
  });

  it('rejects updates that precede creation', () => {
    expect(() =>
      aircraftProfileSchema.parse({
        ...fixture(),
        updatedAt: '2026-07-14T09:59:59.000Z',
      }),
    ).toThrow('Updated time');
  });
});
