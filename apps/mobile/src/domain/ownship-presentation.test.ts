import { describe, expect, it } from 'vitest';

import { presentOwnship } from './ownship-presentation';

describe('ownship presentation', () => {
  it('labels simulated true track and metre accuracy without calling it heading', () => {
    const presentation = presentOwnship({
      accuracyMetres: 49.6,
      origin: 'simulated',
      trackDegrees: 68,
      trackReference: 'true',
    });
    expect(presentation.badge).toBe('SIM ±50 M · 068°T');
    expect(presentation.accessibilityLabel).toContain('true track 68 degrees');
    expect(presentation.accessibilityLabel).not.toContain('heading');
  });

  it('keeps unknown device quality explicit and non-directional', () => {
    expect(
      presentOwnship({
        accuracyMetres: null,
        origin: 'device',
        trackDegrees: null,
        trackReference: 'platform',
      }),
    ).toMatchObject({ badge: 'DEVICE ACC — · TRACK —' });
  });

  it('uses a bounded kilometre label for coarse accuracy', () => {
    expect(
      presentOwnship({
        accuracyMetres: 12_345,
        origin: 'device',
        trackDegrees: 7.6,
        trackReference: 'platform',
      }).badge,
    ).toBe('DEVICE ±12.3 KM · 008° PLATFORM');
  });
});
