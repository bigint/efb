import { describe, expect, it } from 'vitest';

import { parseRunwayWindInput } from './runway-wind-input';

describe('runway wind input', () => {
  it('parses explicit true direction, steady speed, and optional gust', () => {
    expect(parseRunwayWindInput('270', '12', '20')).toMatchObject({
      directionTrue: 270,
      gustSpeed: 20,
      kind: 'ready',
      steadySpeed: 12,
    });
    expect(parseRunwayWindInput('0', '0', '')).toMatchObject({
      gustSpeed: null,
      kind: 'ready',
    });
  });

  it('rejects missing and out-of-range inputs', () => {
    expect(parseRunwayWindInput('', '12', '')).toEqual({
      kind: 'unavailable',
      reason: 'missing-input',
    });
    expect(parseRunwayWindInput('360', '12', '')).toMatchObject({
      reason: 'direction-invalid',
    });
    expect(parseRunwayWindInput('90', '301', '')).toMatchObject({ reason: 'speed-invalid' });
  });

  it('requires gust to be at least the steady speed', () => {
    expect(parseRunwayWindInput('90', '20', '19')).toEqual({
      kind: 'unavailable',
      reason: 'gust-below-steady',
    });
    expect(parseRunwayWindInput('90', '20', 'bad')).toMatchObject({ reason: 'gust-invalid' });
  });
});
