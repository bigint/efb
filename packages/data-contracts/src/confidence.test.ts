import { describe, expect, it } from 'vitest';

import { classifyDataCurrency, isStale, type DataProvenance } from './confidence';

const provenance: DataProvenance = {
  confidence: 'high',
  datasetVersion: 'test-1',
  effectiveAt: '2026-07-14T00:00:00.000Z',
  expiresAt: '2026-07-15T00:00:00.000Z',
  jurisdiction: 'TEST',
  origin: 'real',
  retrievedAt: '2026-07-14T00:00:00.000Z',
  source: 'test fixture',
  sourceTimestamp: '2026-07-14T00:00:00.000Z',
  verificationStatus: 'source-verified',
};

describe('data currency classification', () => {
  it('classifies a bounded effective interval', () => {
    expect(classifyDataCurrency(provenance, new Date('2026-07-14T12:00:00.000Z'))).toBe(
      'current',
    );
    expect(classifyDataCurrency(provenance, new Date('2026-07-15T00:00:00.000Z'))).toBe(
      'expired',
    );
  });

  it('does not treat missing currency bounds as current', () => {
    const unbounded = { ...provenance, effectiveAt: null, expiresAt: null };
    expect(classifyDataCurrency(unbounded, new Date('2026-07-14T12:00:00.000Z'))).toBe(
      'unknown',
    );
    expect(isStale(unbounded, new Date('2026-07-14T12:00:00.000Z'))).toBe(true);
  });

  it('rejects future, invalid, and invalid-clock states', () => {
    expect(classifyDataCurrency(provenance, new Date('2026-07-13T00:00:00.000Z'))).toBe(
      'not-effective',
    );
    expect(
      classifyDataCurrency(
        { ...provenance, verificationStatus: 'invalid' },
        new Date('2026-07-14T12:00:00.000Z'),
      ),
    ).toBe('invalid');
    expect(classifyDataCurrency(provenance, new Date(Number.NaN))).toBe('invalid');
  });
});
