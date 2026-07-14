import { describe, expect, it } from 'vitest';

import { decodeStorageCapacity } from './storage-capacity';

describe('device storage capacity boundary', () => {
  it('derives bounded used storage from native byte values', () => {
    expect(decodeStorageCapacity(1_000, 250)).toEqual({
      availableBytes: 250,
      totalBytes: 1_000,
      usedBytes: 750,
      usedPercent: 75,
    });
  });

  it.each([
    [0, 0],
    [1_000, -1],
    [1_000, 1_001],
    [Number.MAX_SAFE_INTEGER + 1, 1],
  ])('rejects invalid capacity total=%s available=%s', (total, available) => {
    expect(() => decodeStorageCapacity(total, available)).toThrow('invalid');
  });
});
