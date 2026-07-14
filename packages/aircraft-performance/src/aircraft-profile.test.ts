import { describe, expect, it } from 'vitest';

import { aircraftProfileSchema, reviseAircraftProfile } from './aircraft-profile';

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

  it('upgrades legacy planning payloads without inventing a CG envelope', () => {
    expect(aircraftProfileSchema.parse(fixture()).planning.cgEnvelope).toBeNull();
  });

  it('accepts a bounded envelope and rejects duplicate or degenerate points', () => {
    const cgEnvelope = [
      { armM: 0.8, massKg: 600 },
      { armM: 1.1, massKg: 600 },
      { armM: 1, massKg: 1_200 },
    ];
    expect(
      aircraftProfileSchema.parse({
        ...fixture(),
        planning: { ...fixture().planning, cgEnvelope },
      }).planning.cgEnvelope,
    ).toEqual(cgEnvelope);
    expect(() =>
      aircraftProfileSchema.parse({
        ...fixture(),
        planning: {
          ...fixture().planning,
          cgEnvelope: [cgEnvelope[0], cgEnvelope[0], cgEnvelope[1]],
        },
      }),
    ).toThrow('unique');
    expect(() =>
      aircraftProfileSchema.parse({
        ...fixture(),
        planning: {
          ...fixture().planning,
          cgEnvelope: [
            { armM: 0.8, massKg: 600 },
            { armM: 0.9, massKg: 800 },
            { armM: 1, massKg: 1_000 },
          ],
        },
      }),
    ).toThrow('non-zero');
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

  it('rejects control characters in display names used by selectors', () => {
    expect(() =>
      aircraftProfileSchema.parse({ ...fixture(), displayName: 'Trainer\nN999XX' }),
    ).toThrow('control characters');
  });

  it('revises user fields while preserving identity, provenance, and units', () => {
    const profile = aircraftProfileSchema.parse(fixture());
    expect(
      reviseAircraftProfile(
        profile,
        {
          displayName: 'Updated trainer',
          notes: profile.notes,
          planning: profile.planning,
          registration: 'N456DL',
          typeDesignator: profile.typeDesignator,
        },
        '2026-07-14T10:01:00.000Z',
      ),
    ).toMatchObject({
      createdAt: profile.createdAt,
      displayName: 'Updated trainer',
      id: profile.id,
      registration: 'N456DL',
      revision: 2,
      source: 'user-entered',
      units: profile.units,
      verificationStatus: 'unverified',
    });
  });

  it('rejects an aircraft revision timestamp older than the current record', () => {
    const profile = aircraftProfileSchema.parse(fixture());
    expect(() =>
      reviseAircraftProfile(
        profile,
        {
          displayName: profile.displayName,
          notes: profile.notes,
          planning: profile.planning,
          registration: profile.registration,
          typeDesignator: profile.typeDesignator,
        },
        '2026-07-14T09:59:59.000Z',
      ),
    ).toThrow('cannot precede');
  });
});
