import { describe, expect, it } from 'vitest';

import { evaluateTafValidity, parseTafHeader } from './taf';

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
});
