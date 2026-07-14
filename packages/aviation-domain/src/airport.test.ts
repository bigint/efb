import { describe, expect, it } from 'vitest';

import { demoAirports } from './demo-airports';
import { parseAirport, searchAirports } from './airport';

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
});
