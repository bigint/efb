import { describe, expect, it } from 'vitest';

import {
  decodeSavedFlightPlans,
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
});
