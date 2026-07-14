import { describe, expect, it } from 'vitest';

import { parseMetar } from './metar';
import { classifyUsFlightCategory } from './flight-category';

const provenance = {
  confidence: 'unknown',
  datasetVersion: 'test',
  effectiveAt: null,
  expiresAt: null,
  jurisdiction: 'WORLDWIDE',
  origin: 'real',
  retrievedAt: '2026-07-14T12:01:00.000Z',
  source: 'fixture',
  sourceTimestamp: null,
  verificationStatus: 'unverified',
} as const;

const observation = (raw: string) =>
  parseMetar({ provenance, raw, receivedAt: '2026-07-14T12:01:00.000Z' });

describe('U.S. NWS display flight category', () => {
  it('uses the worse of ceiling and visibility thresholds', () => {
    expect(
      classifyUsFlightCategory(
        observation('METAR TEST 141200Z 00000KT 10SM BKN009 20/10 A2992'),
      ),
    ).toMatchObject({ category: 'IFR', ceilingFeetAgl: 900, limitingFactor: 'ceiling' });
    expect(
      classifyUsFlightCategory(observation('METAR TEST 141200Z 00000KT 1/2SM CLR 20/10 A2992')),
    ).toMatchObject({ category: 'LIFR', limitingFactor: 'visibility' });
  });

  it('classifies clear conditions and preserves boundary semantics', () => {
    expect(
      classifyUsFlightCategory(observation('METAR TEST 141200Z 00000KT P6SM SKC 20/10 A2992')),
    ).toMatchObject({ category: 'VFR' });
    expect(
      classifyUsFlightCategory(
        observation('METAR TEST 141200Z 00000KT 3SM BKN030 20/10 A2992'),
      ),
    ).toMatchObject({ category: 'MVFR', limitingFactor: 'both' });
  });

  it('fails closed when visibility or an obscured ceiling height is unknown', () => {
    expect(
      classifyUsFlightCategory(observation('METAR TEST 141200Z 00000KT BKN020 20/10 A2992')),
    ).toEqual({ kind: 'unavailable', reason: 'visibility-unknown' });
    expect(
      classifyUsFlightCategory(
        observation('METAR TEST 141200Z 00000KT 10SM VV/// 20/10 A2992'),
      ),
    ).toEqual({ kind: 'unavailable', reason: 'ceiling-unknown' });
    expect(
      classifyUsFlightCategory(observation('METAR TEST 141200Z 00000KT M3SM CLR 20/10 A2992')),
    ).toEqual({ kind: 'unavailable', reason: 'visibility-bound-ambiguous' });
  });
});
