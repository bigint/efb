import * as Location from 'expo-location';
import { useEffect } from 'react';

import { useFlightStore } from '@/store/flight-store';

const nonNegativeOrNull = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) && value >= 0 ? value : null;

/** Owns the foreground-only native subscription outside individual workspaces. */
export function NativePositionController() {
  const deviceEnabled = useFlightStore((state) => state.positionScenario.kind === 'device');
  const ingestDeviceLocation = useFlightStore((state) => state.ingestDeviceLocation);
  const setDevicePositionStatus = useFlightStore((state) => state.setDevicePositionStatus);

  useEffect(() => {
    if (!deviceEnabled) return;
    const lifecycle = { cancelled: false };
    const isCancelled = () => lifecycle.cancelled;
    let subscription: Location.LocationSubscription | null = null;

    const start = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (isCancelled()) return;
        if (!permission.granted) {
          setDevicePositionStatus(
            permission.canAskAgain ? 'permission-required' : 'permission-denied',
          );
          return;
        }
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (isCancelled()) return;
        if (!servicesEnabled) {
          setDevicePositionStatus('service-disabled');
          return;
        }
        setDevicePositionStatus('watching');
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1,
            timeInterval: 1_000,
          },
          ({ coords, timestamp }) => {
            ingestDeviceLocation({
              accuracyMetres: nonNegativeOrNull(coords.accuracy),
              altitudeMetres:
                coords.altitude !== null && Number.isFinite(coords.altitude)
                  ? coords.altitude
                  : null,
              headingDegrees:
                coords.heading !== null &&
                Number.isFinite(coords.heading) &&
                coords.heading >= 0 &&
                coords.heading < 360
                  ? coords.heading
                  : null,
              latitude: coords.latitude,
              longitude: coords.longitude,
              speedMetresPerSecond: nonNegativeOrNull(coords.speed),
              timestamp,
            });
          },
          () => setDevicePositionStatus('error'),
        );
        if (isCancelled()) subscription.remove();
      } catch {
        if (!isCancelled()) setDevicePositionStatus('error');
      }
    };

    void start();
    return () => {
      lifecycle.cancelled = true;
      subscription?.remove();
    };
  }, [deviceEnabled, ingestDeviceLocation, setDevicePositionStatus]);

  return null;
}
