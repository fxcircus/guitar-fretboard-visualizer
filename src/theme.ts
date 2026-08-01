/**
 * Theme tokens, from the "Fretboard Redesign" Claude Design project.
 *
 * Dark is direction 1A "Workbench" — real wood, warm amber chrome, the board
 * is the instrument. Light is direction 1B "Shop drawing" — a luthier's plate,
 * ink on paper with a rust accent. The board itself (wood, wire, strings, bar)
 * is themed separately per finish in lib/boardStyles.ts.
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
  titleFamily: string;
  transitions: { fast: string };
}

const shared = {
  spacing: { xs: '4px', sm: '8px', md: '14px', lg: '22px' },
  borderRadius: { small: '6px', medium: '10px', large: '16px' },
  fontSizes: { xs: '11px', sm: '13px', md: '15px', lg: '19px' },
  fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  monoFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  titleFamily: "'Instrument Serif', Georgia, serif",
  transitions: { fast: '0.15s ease' },
};

// 1A Workbench
export const darkTheme: Theme = {
  ...shared,
  name: 'dark',
  colors: {
    background: '#12100c',
    card: '#16130f',
    inputBackground: '#221c14',
    border: '#3a3124',
    text: '#f0e9dc',
    textSecondary: '#8b7d68',
    primary: '#e0a55c',
    secondary: '#c8873c',
    accent: '#c8873c',
    warning: '#e5c04a',
    error: '#e2585d',
    buttonText: '#16130f',
  },
  shadows: {
    small: '0 1px 3px rgba(0,0,0,0.45)',
    large: '0 26px 50px rgba(0,0,0,0.65)',
  },
};

// 1B Shop drawing
export const lightTheme: Theme = {
  ...shared,
  name: 'light',
  colors: {
    background: '#e6dfcf',
    card: '#efe9dc',
    inputBackground: '#f7f3e8',
    border: '#c9bfa6',
    text: '#17150f',
    textSecondary: '#6e6754',
    primary: '#a8442a',
    secondary: '#a8442a',
    accent: '#a8442a',
    warning: '#8a6d10',
    error: '#a8442a',
    buttonText: '#efe9dc',
  },
  shadows: {
    small: '0 1px 3px rgba(23,21,15,0.15)',
    large: '8px 8px 0 rgba(23,21,15,0.16)',
  },
};
