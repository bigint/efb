import { describe, expect, it } from 'vitest';

import { decodeAirportFavourites } from './airport-favourite-repository';

describe('airport favourite SQLite boundary', () => {
  it('validates and normalises stored identifiers', () => {
    expect(
      decodeAirportFavourites([{ created_at: '2026-07-14T10:00:00.000Z', identifier: 'dvl1' }]),
    ).toEqual(['DVL1']);
  });

  it('rejects malformed timestamps and duplicate identifiers', () => {
    expect(() =>
      decodeAirportFavourites([{ created_at: 'not-a-time', identifier: 'DVL1' }]),
    ).toThrow();
    expect(() =>
      decodeAirportFavourites([
        { created_at: '2026-07-14T10:00:00.000Z', identifier: 'DVL1' },
        { created_at: '2026-07-14T10:01:00.000Z', identifier: 'dvl1' },
      ]),
    ).toThrow('unique');
    expect(() =>
      decodeAirportFavourites(
        Array.from({ length: 101 }, (_, index) => ({
          created_at: '2026-07-14T10:00:00.000Z',
          identifier: `W${index}`,
        })),
      ),
    ).toThrow('limits');
  });
});
