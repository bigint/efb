import { describe, expect, it } from 'vitest';

import {
  clearCachedWeather,
  decodeCachedWeather,
  deleteCachedWeather,
} from './weather-cache-repository';

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

  it('reparses cached TAF header timing and cache provenance', () => {
    const cached = decodeCachedWeather([
      {
        observed_at: null,
        product: 'TAF',
        raw_text: 'TAF KMCI 141100Z 1412/1512 00000KT P6SM SKC',
        retrieved_at: '2026-07-14T11:05:00.000Z',
        station: 'KMCI',
      },
    ]);
    const record = cached[0];
    expect(record?.product).toBe('TAF');
    if (record?.product !== 'TAF') throw new Error('Expected cached TAF');
    expect(record.report.issuedAt).toBe('2026-07-14T11:00:00.000Z');
    expect(record.report.validFrom).toBe('2026-07-14T12:00:00.000Z');
    expect(record.report.validTo).toBe('2026-07-15T12:00:00.000Z');
    expect(record.report.provenance.source).toContain('local cache');
  });

  it('deletes one validated cache key with bound parameters', async () => {
    const calls: readonly unknown[][] = [];
    const mutableCalls = calls as unknown[][];
    const database = {
      runAsync: (...parameters: readonly unknown[]) => {
        mutableCalls.push([...parameters]);
        return Promise.resolve({ changes: 1 });
      },
    };
    await expect(deleteCachedWeather(database as never, 'METAR', 'KMCI')).resolves.toBe(true);
    expect(calls).toEqual([
      ['DELETE FROM weather_cache WHERE product = ? AND station = ?', 'METAR', 'KMCI'],
    ]);
    await expect(deleteCachedWeather(database as never, 'METAR', 'bad')).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('reports stale single deletes and explicit full-cache deletion counts', async () => {
    const responses = [{ changes: 0 }, { changes: 12 }];
    const database = {
      runAsync: () => Promise.resolve(responses.shift() ?? { changes: 0 }),
    };
    await expect(deleteCachedWeather(database as never, 'TAF', 'KMCI')).resolves.toBe(false);
    await expect(clearCachedWeather(database as never)).resolves.toBe(12);
  });
});
