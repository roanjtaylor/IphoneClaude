// Central palettes + spacing for the Claude-styled UI. The app supports both a dark and a
// light theme; which one is active is resolved at runtime from the OS appearance (or a
// Settings override) by state/ThemeContext, which hands the right palette to every screen
// via useTheme(). `radius`/`spacing` are appearance-independent.

export type Colors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  accent: string;
  accentDim: string;
  text: string;
  textStrong: string;
  textOnAccent: string;
  textMuted: string;
  textFaint: string;
  link: string;
  codeBg: string;
  codeText: string;
  errorBg: string;
  errorText: string;
};

// The original dark palette.
export const darkColors: Colors = {
  bg: '#1a1a1a',
  surface: '#2a2a2a',
  surfaceAlt: '#222',
  border: '#333',
  accent: '#d97757', // Claude clay-orange (user bubble, send button, logo).
  accentDim: '#444',
  text: '#ececec',
  textStrong: '#f5f5f5',
  textOnAccent: '#ffffff',
  textMuted: '#8a8a8a',
  textFaint: '#777',
  link: '#e3a48b',
  codeBg: '#141414',
  codeText: '#e6b3a0',
  errorBg: '#5a1f1f',
  errorText: '#ffd7d7',
};

// A warm light palette in the spirit of the official Claude light theme: off-white "paper"
// background, white surfaces, dark warm text, the same clay accent (darkened where it sits
// on light for contrast).
export const lightColors: Colors = {
  bg: '#faf9f5',
  surface: '#ffffff',
  surfaceAlt: '#f0eee6',
  border: '#e5e2d9',
  accent: '#d97757',
  accentDim: '#dcc7bd',
  text: '#2a2a28',
  textStrong: '#1a1a17',
  textOnAccent: '#ffffff',
  textMuted: '#6c6a62',
  textFaint: '#9a978d',
  link: '#b5562f',
  codeBg: '#f3f1ea',
  codeText: '#a64b27',
  errorBg: '#fbe4e4',
  errorText: '#8a1f1f',
};

export type Scheme = 'light' | 'dark';

export function palette(scheme: Scheme): Colors {
  return scheme === 'light' ? lightColors : darkColors;
}

export const radius = {
  bubble: 16,
  input: 22,
  pill: 999,
  card: 12,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
} as const;
