/**
 * A deliberately plain token set — enough structure for the components to be
 * themeable, no house style baked in. Swap the colour values and the whole app
 * follows.
 */
export interface Theme {
  name: 'dark' | 'light';
  colors: {
    background: string;
    card: string;
    inputBackground: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    accent: string;
    warning: string;
    error: string;
    buttonText: string;
  };
  spacing: { xs: string; sm: string; md: string; lg: string };
  borderRadius: { small: string; medium: string; large: string };
  fontSizes: { xs: string; sm: string; md: string; lg: string };
  shadows: { small: string; large: string };
  fontFamily: string;
  monoFamily: string;
  transitions: { fast: string };
}

const shared = {
  spacing: { xs: '4px', sm: '8px', md: '14px', lg: '22px' },
  borderRadius: { small: '5px', medium: '9px', large: '16px' },
  fontSizes: { xs: '11px', sm: '13px', md: '15px', lg: '19px' },
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  monoFamily: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  transitions: { fast: '0.15s ease' },
};

export const darkTheme: Theme = {
  ...shared,
  name: 'dark',
  colors: {
    background: '#12141a',
    card: '#1a1d26',
    inputBackground: '#20242f',
    border: '#333a49',
    text: '#e8eaf0',
    textSecondary: '#8f97ab',
    primary: '#5eb8ff',
    secondary: '#c8873c',
    accent: '#f0a63c',
    warning: '#e5c04a',
    error: '#e2585d',
    buttonText: '#0d0f14',
  },
  shadows: {
    small: '0 1px 3px rgba(0,0,0,0.4)',
    large: '0 12px 32px rgba(0,0,0,0.55)',
  },
};

export const lightTheme: Theme = {
  ...shared,
  name: 'light',
  colors: {
    background: '#f4f5f8',
    card: '#ffffff',
    inputBackground: '#eef0f5',
    border: '#d3d8e2',
    text: '#1b1f2a',
    textSecondary: '#666e80',
    primary: '#1d6fd0',
    secondary: '#a4611c',
    accent: '#c07405',
    warning: '#9a7c05',
    error: '#c03840',
    buttonText: '#ffffff',
  },
  shadows: {
    small: '0 1px 3px rgba(20,25,40,0.12)',
    large: '0 12px 32px rgba(20,25,40,0.18)',
  },
};
