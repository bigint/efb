import { colours } from '@driftline/design-system';
import { useColorScheme } from 'react-native';

export const useDriftlineTheme = () => {
  const scheme = useColorScheme();
  return scheme === 'light' ? colours.day : colours.night;
};
