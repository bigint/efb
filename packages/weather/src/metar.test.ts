import { describe, expect, it } from 'vitest';

import type { DataProvenance } from '@driftline/data-contracts';

import { evaluateMetarCurrency, parseMetar } from './metar';

const provenance: DataProvenance = {
  confidence: 'high',
  datasetVersion: 'fixture-1',
  effectiveAt: '2026-07-09T19:55:00.000Z',
  expiresAt: '2026-07-09T20:55:00.000Z',
  jurisdiction: 'US',
  origin: 'real',
  retrievedAt: '2026-07-09T20:00:00.000Z',
  source: 'NWS example fixture',
  sourceTimestamp: '2026-07-09T19:55:00.000Z',
  verificationStatus: 'source-verified',
};

const parse = (raw: string, receivedAt = '2026-07-09T20:00:00.000Z') =>
  parseMetar({ provenance, raw, receivedAt });

describe('conservative METAR adapter', () => {
  it('parses the documented U.S. body groups and preserves remarks', () => {
    const result = parse(
      'METAR KPGT 091955Z COR 22015G25KT 3/4SM R28L/2600FT TSRA OVC010CB 18/18 A2992 RMK SLP045 T01820159',
    );
    expect(result.kind).toBe('METAR');
    expect(result.station).toBe('KPGT');
    expect(result.observedAt).toBe('2026-07-09T19:55:00.000Z');
    expect(result.corrected).toBe(true);
    expect(result.wind).toMatchObject({ direction: 220, gust: 25, speed: 15 });
    expect(result.visibility?.metres).toBeCloseTo(1_207.008, 3);
    expect(result.presentWeatherCodes).toEqual(['TSRA']);
    expect(result.clouds).toEqual([
      { amount: 'OVC', baseFeetAgl: 1_000, convectiveType: 'CB' },
    ]);
    expect(result.temperature).toBe(18);
    expect(result.dewpoint).toBe(18);
    expect(result.altimeter).toBeCloseTo(1_013.21, 1);
    expect(result.unparsedBodyGroups).toEqual(['R28L/2600FT']);
    expect(result.remarks).toBe('SLP045 T01820159');
  });

  it('resolves month boundaries from the trusted receipt timestamp', () => {
    const result = parse(
      'METAR TEST 312355Z 00000KT CAVOK 10/05 Q1013',
      '2027-01-01T00:05:00.000Z',
    );
    expect(result.observedAt).toBe('2026-12-31T23:55:00.000Z');
    expect(result.cavok).toBe(true);
    expect(result.visibility).toEqual({
      bound: 'greater-than',
      metres: 10_000,
      sourceUnit: 'metres',
    });
    expect(result.altimeter).toBe(1_013);
  });

  it('parses variable wind, mixed visibility, negative temperature, and unknown cloud base', () => {
    const result = parse(
      'SPECI KAAA 091955Z AUTO VRB03KT 120V240 1 1/2SM -SN VV/// M04/M07 Q1020 UNK',
    );
    expect(result.automated).toBe(true);
    expect(result.wind).toMatchObject({
      direction: null,
      speed: 3,
      variable: true,
      variableFrom: 120,
      variableTo: 240,
    });
    expect(result.visibility?.metres).toBeCloseTo(2_414.016, 3);
    expect(result.temperature).toBe(-4);
    expect(result.dewpoint).toBe(-7);
    expect(result.clouds[0]?.baseFeetAgl).toBeNull();
    expect(result.unparsedBodyGroups).toEqual(['UNK']);
  });

  it('preserves unsupported international units instead of inventing a conversion', () => {
    const result = parse('METAR LBBG 091955Z 12012MPS 1400 M04/M07 Q1020');
    expect(result.wind).toBeNull();
    expect(result.visibility).toBeNull();
    expect(result.unparsedBodyGroups).toEqual(['12012MPS', '1400']);
  });

  it('preserves invalid direction and pressure groups instead of wrapping them', () => {
    const result = parse('METAR KAAA 091955Z 99910KT 999V999 10SM A0000');
    expect(result.wind).toBeNull();
    expect(result.altimeter).toBeNull();
    expect(result.unparsedBodyGroups).toEqual(['99910KT', '999V999', 'A0000']);
  });

  it('distinguishes less-than and greater-than visibility bounds', () => {
    expect(parse('METAR KAAA 091955Z 00000KT M1/4SM').visibility).toMatchObject({
      bound: 'less-than',
    });
    expect(parse('METAR KAAA 091955Z 00000KT P6SM').visibility).toMatchObject({
      bound: 'greater-than',
    });
  });

  it.each([
    'METAR 091955Z 00000KT 10SM',
    'METAR KAAA 321955Z 00000KT 10SM',
    'METAR KAAA 092455Z 00000KT 10SM',
  ])('rejects an unusable identity/time boundary: %s', (raw) => {
    expect(() => parse(raw)).toThrow(RangeError);
  });

  it('evaluates observation and provenance currency together', () => {
    const observation = parse('METAR KAAA 091955Z 00000KT 10SM');
    expect(evaluateMetarCurrency(observation, new Date('2026-07-09T20:00:00.000Z'))).toEqual({
      ageMilliseconds: 5 * 60 * 1_000,
      kind: 'current',
    });
    expect(evaluateMetarCurrency(observation, new Date('2026-07-09T20:56:00.000Z'))).toEqual({
      kind: 'unavailable',
      reason: 'provenance-expired',
    });
  });

  it('fails closed for future, stale, unknown-provenance, and invalid-clock states', () => {
    const observation = parse('METAR KAAA 091955Z 00000KT 10SM');
    expect(evaluateMetarCurrency(observation, new Date('2026-07-09T19:54:00.000Z'))).toEqual({
      kind: 'unavailable',
      reason: 'observation-future',
    });
    expect(
      evaluateMetarCurrency(observation, new Date('2026-07-09T20:40:00.000Z'), 30 * 60 * 1_000),
    ).toEqual({ kind: 'unavailable', reason: 'observation-stale' });
    expect(
      evaluateMetarCurrency(
        {
          ...observation,
          provenance: { ...observation.provenance, effectiveAt: null, expiresAt: null },
        },
        new Date('2026-07-09T20:00:00.000Z'),
      ),
    ).toEqual({ kind: 'unavailable', reason: 'provenance-unknown' });
    expect(evaluateMetarCurrency(observation, new Date(Number.NaN))).toEqual({
      kind: 'unavailable',
      reason: 'clock-invalid',
    });
  });

  it('does not label unverified or simulated provenance as current weather', () => {
    const observation = parse('METAR KAAA 091955Z 00000KT 10SM');
    expect(
      evaluateMetarCurrency(
        {
          ...observation,
          provenance: { ...observation.provenance, verificationStatus: 'unverified' },
        },
        new Date('2026-07-09T20:00:00.000Z'),
      ),
    ).toEqual({ kind: 'unavailable', reason: 'provenance-unverified' });
    expect(
      evaluateMetarCurrency(
        {
          ...observation,
          provenance: { ...observation.provenance, origin: 'simulated' },
        },
        new Date('2026-07-09T20:00:00.000Z'),
      ),
    ).toEqual({ kind: 'unavailable', reason: 'provenance-non-real' });
  });
});
