import { describe, expect, it } from 'vitest';

import { estimateArrivalUtc } from './arrival-estimate';

describe('arrival estimate', () => {
  it('adds a transient duration on the UTC clock across a date boundary', () => {
    expect(estimateArrivalUtc(Date.parse('2026-07-14T23:50:00.000Z'), 25)).toEqual({
      isoUtc: '2026-07-15T00:15:00.000Z',
      kind: 'ready',
    });
  });

  it('distinguishes missing groundspeed from invalid clocks and unsupported duration', () => {
    expect(estimateArrivalUtc(Date.now(), null)).toEqual({
      kind: 'unavailable',
      reason: 'duration-unavailable',
    });
    expect(estimateArrivalUtc(Number.NaN, 10)).toEqual({
      kind: 'unavailable',
      reason: 'system-clock-invalid',
    });
    expect(estimateArrivalUtc(Date.now(), 10_081)).toEqual({
      kind: 'unavailable',
      reason: 'outside-supported-range',
    });
  });
});
