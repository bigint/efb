import { describe, expect, it } from 'vitest';

import { demoAirports } from './demo-airports';
import { findNearbyAirports, parseAirport, searchAirports } from './airport';

describe('airport adapter boundary', () => {
  it('prioritises exact identifiers', () => {
    expect(searchAirports(demoAirports, 'DVL2').map(({ icao }) => icao)).toEqual(['DVL2']);
  });

  it('requires a meaningful local-search query', () => {
    expect(searchAirports(demoAirports, 'd')).toEqual([]);
  });

  it('rejects malformed coordinates and unknown fields', () => {
    const valid = {
      elevationFeet: 1,
      iata: null,
      icao: 'TEST',
      name: 'Test',
      position: { latitude: 91, longitude: 0 },
      provenance: demoAirports[0]?.provenance,
      runways: [],
      timezone: 'UTC',
      unexpected: true,
    };
    expect(() => parseAirport(valid)).toThrow();
  });

  it('rejects invalid provenance, duplicate runways, and invalid timezones', () => {
    const source = {
      elevationFeet: 1,
      iata: null,
      icao: 'TEST',
      name: 'Test',
      position: { latitude: 1, longitude: 1 },
      provenance: demoAirports[0]?.provenance,
      runways: [
        {
          designator: '09/27',
          headingTrueDegrees: 90,
          lengthMetres: 1_000,
          surface: 'Test',
          widthMetres: 20,
        },
      ],
      timezone: 'UTC',
    };
    expect(() =>
      parseAirport({
        ...source,
        provenance: { ...source.provenance, verificationStatus: 'invalid' },
      }),
    ).toThrow();
    expect(() =>
      parseAirport({ ...source, runways: [...source.runways, ...source.runways] }),
    ).toThrow();
    expect(() => parseAirport({ ...source, timezone: 'Mars/Olympus_Mons' })).toThrow();
  });

  it('rejects identifier casing that could produce ambiguous lookups', () => {
    expect(() =>
      parseAirport({
        elevationFeet: 1,
        iata: null,
        icao: 'dvl1',
        name: 'Test',
        position: { latitude: 1, longitude: 1 },
        provenance: demoAirports[0]?.provenance,
        runways: [],
        timezone: 'UTC',
      }),
    ).toThrow();
  });

  it('rejects unbounded or unsafe display fields before normalization', () => {
    const source = {
      elevationFeet: 1,
      iata: null,
      icao: 'TEST',
      name: 'Test',
      position: { latitude: 1, longitude: 1 },
      provenance: demoAirports[0]?.provenance,
      runways: [],
      timezone: 'UTC',
    };
    expect(() => parseAirport({ ...source, name: 'Unsafe\nname' })).toThrow();
    expect(() =>
      parseAirport({
        ...source,
        runways: Array.from({ length: 21 }, (_, index) => ({
          designator: String(index).padStart(2, '0'),
          headingTrueDegrees: index,
          lengthMetres: 1_000,
          surface: 'Test',
          widthMetres: 20,
        })),
      }),
    ).toThrow();
    expect(searchAirports(demoAirports, 'X'.repeat(81))).toEqual([]);
  });

  it('ranks nearby airports deterministically and excludes the origin', () => {
    const origin = demoAirports[0];
    if (origin === undefined) throw new Error('Missing origin fixture');
    const nearby = findNearbyAirports(demoAirports, origin, 1);
    expect(nearby).toHaveLength(1);
    expect(nearby[0]?.airport.icao).not.toBe(origin.icao);
    expect(nearby[0]?.distanceNauticalMiles).toBeGreaterThan(0);
    expect(() => findNearbyAirports([origin, origin], origin)).toThrow('unique');
    expect(() => findNearbyAirports([origin], origin, 0)).toThrow(RangeError);
  });
});
