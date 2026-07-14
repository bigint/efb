import { describe, expect, it } from 'vitest';

import { decodeCachedWeather } from './weather-cache-repository';

describe('weather cache SQLite boundary', () => {
  it('reparses cached METAR and preserves explicit cache provenance', () => {
    const cached = decodeCachedWeather([
      {
        observed_at: '2026-07-14T12:00:00.000Z',
        product: 'METAR',
        raw_text: 'METAR KMCI 141200Z 00000KT 10SM CLR 20/10 A2992',
        retrieved_at: '2026-07-14T12:01:00.000Z',
        station: 'KMCI',
      },
    ]);
    const record = cached[0];
    expect(record?.product).toBe('METAR');
    if (record?.product !== 'METAR') throw new Error('Expected cached METAR');
    expect(record.observation.station).toBe('KMCI');
    expect(record.observation.provenance.source).toContain('local cache');
  });

  it('rejects changed station/time bindings and multiple TAF products', () => {
    expect(() =>
      decodeCachedWeather([
        {
          observed_at: '2026-07-14T12:00:00.000Z',
          product: 'METAR',
          raw_text: 'METAR KMCI 141200Z 00000KT 10SM CLR 20/10 A2992',
          retrieved_at: '2026-07-14T12:01:00.000Z',
          station: 'KDEN',
        },
      ]),
    ).toThrow('station');
    expect(() =>
      decodeCachedWeather([
        {
          observed_at: null,
          product: 'TAF',
          raw_text:
            'TAF KMCI 141100Z 1412/1512 00000KT P6SM SKC\nTAF KDEN 141100Z 1412/1512 00000KT P6SM SKC',
          retrieved_at: '2026-07-14T12:01:00.000Z',
          station: 'KMCI',
        },
      ]),
    ).toThrow('TAF');
  });
});
