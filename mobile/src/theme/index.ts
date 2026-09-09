import { useColorScheme } from 'react-native';

/**
 * The web app's design tokens, expressed as plain values. The two projects are
 * separate by design, so this is a deliberate copy rather than a shared import;
 * keep it in step with app/src/app/globals.css when the palette changes.
 */
export interface Theme {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  destructive: string;
}

const light: Theme = {
  background: '#fbfbfc',
  card: '#ffffff',
  foreground: '#26292e',
  muted: '#f4f5f6',
  mutedForeground: '#71767e',
  border: '#e5e7ea',
  primary: '#33373d',
  primaryForeground: '#fafafa',
  success: '#0f9b6c',
  successForeground: '#ffffff',
  warning: '#c78a1e',
  destructive: '#d64545',
};

const dark: Theme = {
  background: '#16191d',
  card: '#1e2126',
  foreground: '#f2f3f4',
  muted: '#2a2e34',
  mutedForeground: '#a4a9b0',
  border: '#33383f',
  primary: '#eceef0',
  primaryForeground: '#1e2126',
  success: '#2bb98a',
  successForeground: '#0f1214',
  warning: '#d9a441',
  destructive: '#e56a6a',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 6, md: 10, lg: 14, xl: 18 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Burmese script needs more vertical room than Latin at the same font size, and
 * clips descenders at the line-heights that look right for English.
 */
export const lineHeightFor = (fontSize: number, locale: string) =>
  Math.round(fontSize * (locale === 'my' ? 1.75 : 1.35));
