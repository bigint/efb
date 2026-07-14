export const colours = {
  day: {
    accent: '#007E87',
    attention: '#A85B08',
    background: '#E7ECEB',
    danger: '#B4282F',
    mapLand: '#CCD5D1',
    mapWater: '#A9C8CF',
    onAccent: '#FFFFFF',
    panel: '#F7F9F8',
    panelRaised: '#FFFFFF',
    primary: '#13201F',
    secondary: '#526260',
    separator: '#C5CECB',
    simulation: '#6B4AA0',
  },
  night: {
    accent: '#45C0C6',
    attention: '#F1A84D',
    background: '#07100F',
    danger: '#FF6F77',
    mapLand: '#17221F',
    mapWater: '#10272C',
    onAccent: '#07100F',
    panel: '#0D1715',
    panelRaised: '#14201E',
    primary: '#E6EFEC',
    secondary: '#9AA9A5',
    separator: '#263633',
    simulation: '#B795E7',
  },
  highContrastDay: {
    accent: '#005A61',
    attention: '#6F3600',
    background: '#FFFFFF',
    danger: '#8B0000',
    mapLand: '#D8D8D8',
    mapWater: '#A8D8E8',
    onAccent: '#FFFFFF',
    panel: '#FFFFFF',
    panelRaised: '#FFFFFF',
    primary: '#000000',
    secondary: '#303030',
    separator: '#000000',
    simulation: '#4C237A',
  },
  highContrastNight: {
    accent: '#7FE7EC',
    attention: '#FFD27A',
    background: '#000000',
    danger: '#FF9CA2',
    mapLand: '#111111',
    mapWater: '#0A2A32',
    onAccent: '#000000',
    panel: '#000000',
    panelRaised: '#0A0A0A',
    primary: '#FFFFFF',
    secondary: '#D0D0D0',
    separator: '#FFFFFF',
    simulation: '#D5B5FF',
  },
} as const;

export type ColourScheme = 'dark' | 'light';

export const selectColourPalette = (scheme: ColourScheme, highContrast: boolean) =>
  highContrast
    ? scheme === 'light'
      ? colours.highContrastDay
      : colours.highContrastNight
    : scheme === 'light'
      ? colours.day
      : colours.night;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { control: 10, panel: 16, capsule: 999 } as const;
export const cockpitTarget = 48;

export const typography = {
  body: 'Avenir Next',
  display: 'Avenir Next Condensed',
  mono: 'Menlo',
} as const;
