export const colours = {
  day: {
    accent: '#007E87',
    attention: '#A85B08',
    background: '#E7ECEB',
    danger: '#B4282F',
    mapLand: '#CCD5D1',
    mapWater: '#A9C8CF',
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
    panel: '#0D1715',
    panelRaised: '#14201E',
    primary: '#E6EFEC',
    secondary: '#9AA9A5',
    separator: '#263633',
    simulation: '#B795E7',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { control: 10, panel: 16, capsule: 999 } as const;
export const cockpitTarget = 48;

export const typography = {
  body: 'Avenir Next',
  display: 'Avenir Next Condensed',
  mono: 'Menlo',
} as const;
