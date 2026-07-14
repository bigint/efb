import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

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
    let generation = 0;
    let subscription: Location.LocationSubscription | null = null;

    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    const start = async (expectedGeneration: number) => {
      const isStale = () =>
        lifecycle.cancelled ||
        expectedGeneration !== generation ||
        AppState.currentState !== 'active';
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (isStale()) return;
        if (!permission.granted) {
          setDevicePositionStatus(
            permission.canAskAgain ? 'permission-required' : 'permission-denied',
          );
          return;
        }
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (isStale()) return;
        if (!servicesEnabled) {
          setDevicePositionStatus('service-disabled');
          return;
        }
        const nextSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1,
            timeInterval: 1_000,
          },
          ({ coords, timestamp }) => {
            if (isStale()) return;
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
          () => {
            if (!isStale()) setDevicePositionStatus('error');
          },
        );
        if (isStale()) {
          nextSubscription.remove();
          return;
        }
        stop();
        subscription = nextSubscription;
        setDevicePositionStatus('watching');
      } catch {
        if (!isStale()) setDevicePositionStatus('error');
      }
    };

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      generation += 1;
      stop();
      setDevicePositionStatus('checking');
      if (state === 'active') void start(generation);
    });
    if (AppState.currentState === 'active') void start(generation);
    else setDevicePositionStatus('checking');
    return () => {
      lifecycle.cancelled = true;
      generation += 1;
      appStateSubscription.remove();
      stop();
    };
  }, [deviceEnabled, ingestDeviceLocation, setDevicePositionStatus]);

  return null;
}
