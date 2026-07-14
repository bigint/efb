import { describe, expect, it } from 'vitest';

import { selectColourPalette } from './tokens';

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
};

const contrast = (left: string, right: string): number => {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
};

describe('high-contrast colour palettes', () => {
  it.each(['light', 'dark'] as const)(
    'meets text contrast targets in %s appearance',
    (scheme) => {
      const palette = selectColourPalette(scheme, true);
      expect(contrast(palette.primary, palette.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.secondary, palette.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.danger, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.attention, palette.background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('retains the requested standard palette when high contrast is off', () => {
    expect(selectColourPalette('light', false).background).toBe('#E7ECEB');
    expect(selectColourPalette('dark', false).background).toBe('#07100F');
  });
});
