import { describe, expect, it } from 'vitest';

import {
  resolveSavedFlightPlan,
  reviseSavedFlightPlan,
  savedFlightPlanSchema,
} from './flight-plan';

const fixture = () => ({
  aircraftId: null,
  altitudeFeet: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  departureTime: null,
  id: '019f5f42-a146-7c00-861d-7ad2313bbbd4',
  notes: '',
  revision: 1,
  status: 'draft',
  title: 'Demo route',
  updatedAt: '2026-07-14T10:00:00.000Z',
  waypoints: [
    { identifier: 'dvl1', latitude: 12, longitude: 77, sequence: 0, sourceRef: 'demo:DVL1' },
    { identifier: 'dvl2', latitude: 13, longitude: 78, sequence: 1, sourceRef: 'demo:DVL2' },
  ],
});

describe('saved flight plan', () => {
  it('normalises and validates a durable ordered route', () => {
    expect(savedFlightPlanSchema.parse(fixture())).toMatchObject({
      revision: 1,
      status: 'draft',
      waypoints: [{ identifier: 'DVL1' }, { identifier: 'DVL2' }],
    });
  });

  it('rejects gaps and duplicate waypoint identifiers', () => {
    const source = fixture();
    expect(() =>
      savedFlightPlanSchema.parse({
        ...source,
        waypoints: [source.waypoints[0], { ...source.waypoints[1], sequence: 2 }],
      }),
    ).toThrow('contiguous');
    expect(() =>
      savedFlightPlanSchema.parse({
        ...source,
        waypoints: [source.waypoints[0], { ...source.waypoints[1], identifier: 'DVL1' }],
      }),
    ).toThrow('unique');
  });

  it('rejects impossible altitude and timestamp order', () => {
    expect(() => savedFlightPlanSchema.parse({ ...fixture(), altitudeFeet: 60_001 })).toThrow();
    expect(() =>
      savedFlightPlanSchema.parse({
        ...fixture(),
        updatedAt: '2026-07-14T09:59:59.000Z',
      }),
    ).toThrow('Updated time');
  });

  it('rejects control characters in a title shown by native confirmation UI', () => {
    expect(() =>
      savedFlightPlanSchema.parse({ ...fixture(), title: 'Route\nArchive?' }),
    ).toThrow('control characters');
  });

  it('blocks loading when the active dataset no longer matches the saved waypoint snapshot', () => {
    const plan = savedFlightPlanSchema.parse(fixture());
    const available = plan.waypoints.map((waypoint) => ({ ...waypoint }));
    expect(resolveSavedFlightPlan(plan, available)).toMatchObject({ status: 'ready' });
    expect(
      resolveSavedFlightPlan(plan, [{ ...available[0]!, latitude: 12.1 }, available[1]!]),
    ).toEqual({ mismatchedIdentifiers: ['DVL1'], status: 'dataset-mismatch' });
  });

  it('creates the next revision without allowing identity fields to drift', () => {
    const plan = savedFlightPlanSchema.parse(fixture());
    expect(
      reviseSavedFlightPlan(
        plan,
        { status: 'archived', title: 'Renamed route' },
        '2026-07-14T10:01:00.000Z',
      ),
    ).toMatchObject({
      createdAt: plan.createdAt,
      id: plan.id,
      revision: 2,
      status: 'archived',
      title: 'Renamed route',
      waypoints: plan.waypoints,
    });
  });

  it('rejects a revision timestamp older than the stored plan', () => {
    const plan = savedFlightPlanSchema.parse(fixture());
    expect(() =>
      reviseSavedFlightPlan(plan, { title: 'Renamed route' }, '2026-07-14T09:59:59.000Z'),
    ).toThrow('cannot precede');
  });
});
