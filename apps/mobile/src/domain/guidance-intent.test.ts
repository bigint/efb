import { describe, expect, it } from 'vitest';

import { selectActiveLegIntent, selectDirectToIntent } from './guidance-intent';

describe('navigation guidance intent', () => {
  it('keeps active-leg and direct-to intent mutually exclusive', () => {
    expect(selectDirectToIntent('DVL2', ['DVL1', 'DVL2'])).toEqual({
      activeLegIndex: null,
      directToIdentifier: 'DVL2',
    });
    expect(selectActiveLegIntent(0, 2)).toEqual({
      activeLegIndex: 0,
      directToIdentifier: null,
    });
  });

  it('rejects unavailable targets and out-of-range legs', () => {
    expect(() => selectDirectToIntent('MISSING', ['DVL1'])).toThrow('unavailable');
    expect(() => selectActiveLegIntent(1, 2)).toThrow('outside');
  });
});
