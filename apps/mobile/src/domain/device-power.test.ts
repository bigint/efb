import { describe, expect, it } from 'vitest';

import { decodeDevicePower } from './device-power';

describe('device power boundary', () => {
  it('normalizes supported native power states', () => {
    expect(
      decodeDevicePower({ batteryLevel: 0.734, batteryState: 1, lowPowerMode: true }),
    ).toEqual({
      batteryState: 'unplugged',
      kind: 'available',
      levelPercent: 73,
      lowPowerMode: true,
    });
    expect(
      decodeDevicePower({ batteryLevel: 1, batteryState: 3, lowPowerMode: false }),
    ).toMatchObject({ batteryState: 'full', levelPercent: 100 });
  });

  it.each([
    { batteryLevel: -1, batteryState: 0, lowPowerMode: false },
    { batteryLevel: Number.NaN, batteryState: 1, lowPowerMode: false },
    { batteryLevel: 0.5, batteryState: 5, lowPowerMode: false },
    { batteryLevel: 0.5, batteryState: 1.5, lowPowerMode: false },
  ])('fails closed for unsupported native telemetry', (state) => {
    expect(decodeDevicePower(state)).toEqual({ kind: 'unavailable' });
  });
});
