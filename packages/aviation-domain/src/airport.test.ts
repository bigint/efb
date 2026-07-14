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
});
