// Central palette + spacing for the dark, Claude-styled UI. Extracted from the
// original App.tsx inline styles so every screen/component shares one source of truth.

export const colors = {
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
  errorBg: '#5a1f1f',
  errorText: '#ffd7d7',
} as const;

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
