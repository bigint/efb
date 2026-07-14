import { describe, expect, it } from 'vitest';

import { evaluateTafValidity, parseTafHeader, parseTafTimeline } from './taf';

const provenance = {
  confidence: 'unknown',
  datasetVersion: 'test',
  effectiveAt: null,
  expiresAt: null,
  jurisdiction: 'WORLDWIDE',
  origin: 'real',
  retrievedAt: '2026-07-31T23:40:00.000Z',
  source: 'fixture',
  sourceTimestamp: null,
  verificationStatus: 'source-verified',
} as const;

describe('TAF header boundary', () => {
  it('resolves issue and validity across a UTC month boundary', () => {
    expect(
      parseTafHeader({
        provenance,
        raw: 'TAF AMD TEST 312330Z 0100/0206 18008KT P6SM SKC',
        receivedAt: '2026-07-31T23:40:00.000Z',
      }),
    ).toMatchObject({
      amendment: 'amended',
      issuedAt: '2026-07-31T23:30:00.000Z',
      station: 'TEST',
      validFrom: '2026-08-01T00:00:00.000Z',
      validTo: '2026-08-02T06:00:00.000Z',
    });
  });

  it('accepts hour 24 as the following UTC midnight', () => {
    expect(
      parseTafHeader({
        provenance,
        raw: 'TAF TEST 311700Z 3118/3124 18008KT P6SM SKC',
        receivedAt: '2026-07-31T17:10:00.000Z',
      }).validTo,
    ).toBe('2026-08-01T00:00:00.000Z');
  });

  it('rejects malformed or impossible validity windows', () => {
    expect(() =>
      parseTafHeader({
        provenance,
        raw: 'TAF TEST 311700Z 3118/3117 18008KT P6SM SKC',
        receivedAt: '2026-07-31T17:10:00.000Z',
      }),
    ).toThrow('end');
  });

  it('evaluates header validity against an explicit UTC clock', () => {
    const report = parseTafHeader({
      provenance,
      raw: 'TAF TEST 311700Z 3118/3124 18008KT P6SM SKC',
      receivedAt: '2026-07-31T17:10:00.000Z',
    });
    expect(evaluateTafValidity(report, new Date('2026-07-31T19:00:00.000Z'))).toEqual({
      kind: 'current',
    });
    expect(evaluateTafValidity(report, new Date('2026-08-01T00:00:00.000Z'))).toEqual({
      kind: 'unavailable',
      reason: 'validity-expired',
    });
  });

  it('does not label unverified or simulated provenance as currently valid weather', () => {
    const report = parseTafHeader({
      provenance,
      raw: 'TAF TEST 311700Z 3118/3124 18008KT P6SM SKC',
      receivedAt: '2026-07-31T17:10:00.000Z',
    });
    const now = new Date('2026-07-31T19:00:00.000Z');
    expect(
      evaluateTafValidity(
        { ...report, provenance: { ...report.provenance, verificationStatus: 'unverified' } },
        now,
      ),
    ).toEqual({ kind: 'unavailable', reason: 'provenance-unverified' });
    expect(
      evaluateTafValidity(
        { ...report, provenance: { ...report.provenance, origin: 'simulated' } },
        now,
      ),
    ).toEqual({ kind: 'unavailable', reason: 'provenance-non-real' });
  });
});

describe('TAF change-marker timeline', () => {
  it('resolves FM, range, and probability markers without decoding conditions', () => {
    const report = parseTafHeader({
      provenance,
      raw: `TAF TEST 312330Z 0100/0206 18008KT P6SM SKC
        FM010130 22010KT 5SM BKN020
        TEMPO 0102/0105 2SM -RA
        BECMG 0105/0106 28012KT
        PROB30 TEMPO 0200/0203 1SM TSRA`,
      receivedAt: '2026-07-31T23:40:00.000Z',
    });
    expect(parseTafTimeline(report)).toEqual({
      baseForecastRaw: '18008KT P6SM SKC',
      groups: [
        {
          endsAt: null,
          kind: 'from',
          marker: 'FM010130',
          probabilityPercent: null,
          rawConditions: '22010KT 5SM BKN020',
          startsAt: '2026-08-01T01:30:00.000Z',
        },
        {
          endsAt: '2026-08-01T05:00:00.000Z',
          kind: 'temporary',
          marker: 'TEMPO 0102/0105',
          probabilityPercent: null,
          rawConditions: '2SM -RA',
          startsAt: '2026-08-01T02:00:00.000Z',
        },
        {
          endsAt: '2026-08-01T06:00:00.000Z',
          kind: 'becoming',
          marker: 'BECMG 0105/0106',
          probabilityPercent: null,
          rawConditions: '28012KT',
          startsAt: '2026-08-01T05:00:00.000Z',
        },
        {
          endsAt: '2026-08-02T03:00:00.000Z',
          kind: 'probability-temporary',
          marker: 'PROB30 TEMPO 0200/0203',
          probabilityPercent: 30,
          rawConditions: '1SM TSRA',
          startsAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    });
  });

  it('accepts a base-only forecast with no change markers', () => {
    const report = parseTafHeader({
      provenance,
      raw: 'TAF TEST 311700Z 3118/3124 18008KT P6SM SKC',
      receivedAt: '2026-07-31T17:10:00.000Z',
    });
    expect(parseTafTimeline(report)).toEqual({
      baseForecastRaw: '18008KT P6SM SKC',
      groups: [],
    });
  });

  it('fails closed on malformed, empty, or out-of-window markers', () => {
    const parse = (body: string) =>
      parseTafTimeline(
        parseTafHeader({
          provenance,
          raw: `TAF TEST 311700Z 3118/3124 18008KT P6SM SKC ${body}`,
          receivedAt: '2026-07-31T17:10:00.000Z',
        }),
      );
    expect(() => parse('FM312460 BKN020')).toThrow('malformed');
    expect(() => parse('PROB50 3120/3122 BKN020')).toThrow('malformed');
    expect(() => parse('TEMPO 3120/3122')).toThrow('no conditions');
    expect(() => parse('FM010000 BKN020')).toThrow('outside');
  });
});
