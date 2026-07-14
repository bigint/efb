import { selectColourPalette } from '@driftline/design-system';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';

let highContrastEnabled = false;
let initialised = false;
const listeners = new Set<() => void>();

const publishHighContrast = (enabled: boolean): void => {
  if (enabled === highContrastEnabled) return;
  highContrastEnabled = enabled;
  for (const listener of listeners) listener();
};

const initialiseHighContrast = (): void => {
  if (initialised) return;
  initialised = true;
  const query =
    Platform.OS === 'ios'
      ? AccessibilityInfo.isDarkerSystemColorsEnabled()
      : Platform.OS === 'android'
        ? AccessibilityInfo.isHighTextContrastEnabled()
        : Promise.resolve(false);
  void query.then(publishHighContrast).catch(() => publishHighContrast(false));
  if (Platform.OS === 'ios') {
    AccessibilityInfo.addEventListener('darkerSystemColorsChanged', publishHighContrast);
  } else if (Platform.OS === 'android') {
    AccessibilityInfo.addEventListener('highTextContrastChanged', publishHighContrast);
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  initialiseHighContrast();
  return () => {
    listeners.delete(listener);
  };
};

const getHighContrastSnapshot = (): boolean => highContrastEnabled;

export const useHighContrastEnabled = (): boolean =>
  useSyncExternalStore(subscribe, getHighContrastSnapshot, () => false);

export const useDriftlineTheme = () => {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return selectColourPalette(scheme, useHighContrastEnabled());
};
