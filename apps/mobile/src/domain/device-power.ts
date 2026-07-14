export type DeviceBatteryState = 'charging' | 'full' | 'not-charging' | 'unknown' | 'unplugged';

export type DevicePowerStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | {
      readonly batteryState: DeviceBatteryState;
      readonly kind: 'available';
      readonly levelPercent: number;
      readonly lowPowerMode: boolean;
    };

export interface NativePowerState {
  readonly batteryLevel: number;
  readonly batteryState: number;
  readonly lowPowerMode: boolean;
}

export const decodeDevicePower = (state: NativePowerState): DevicePowerStatus => {
  if (
    !Number.isFinite(state.batteryLevel) ||
    state.batteryLevel < 0 ||
    state.batteryLevel > 1 ||
    !Number.isInteger(state.batteryState) ||
    state.batteryState < 0 ||
    state.batteryState > 4
  ) {
    return { kind: 'unavailable' };
  }
  const batteryStates = ['unknown', 'unplugged', 'charging', 'full', 'not-charging'] as const;
  const batteryState = batteryStates[state.batteryState];
  if (batteryState === undefined) return { kind: 'unavailable' };
  return {
    batteryState,
    kind: 'available',
    levelPercent: Math.round(state.batteryLevel * 100),
    lowPowerMode: state.lowPowerMode,
  };
};
