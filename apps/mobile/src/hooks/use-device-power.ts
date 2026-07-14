import * as Battery from 'expo-battery';
import { useEffect, useState } from 'react';

import { decodeDevicePower, type DevicePowerStatus } from '@/domain/device-power';

export function useDevicePower(): DevicePowerStatus {
  const [status, setStatus] = useState<DevicePowerStatus>({ kind: 'loading' });

  useEffect(() => {
    let request = 0;
    const refresh = async () => {
      const currentRequest = ++request;
      try {
        const available = await Battery.isAvailableAsync();
        if (currentRequest !== request) return;
        if (!available) {
          setStatus({ kind: 'unavailable' });
          return;
        }
        const power = await Battery.getPowerStateAsync();
        if (currentRequest !== request) return;
        setStatus(decodeDevicePower(power));
      } catch {
        if (currentRequest === request) setStatus({ kind: 'unavailable' });
      }
    };

    const subscriptions = [
      Battery.addBatteryLevelListener(() => void refresh()),
      Battery.addBatteryStateListener(() => void refresh()),
      Battery.addLowPowerModeListener(() => void refresh()),
    ];
    void refresh();
    return () => {
      request += 1;
      for (const subscription of subscriptions) subscription.remove();
    };
  }, []);

  return status;
}
