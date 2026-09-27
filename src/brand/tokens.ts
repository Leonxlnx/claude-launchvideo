// Tessel brand tokens. One accent, everything else is ink and paper.

export const C = {
  ink: '#0B0B0C',
  ink2: '#1A1A1D',
  paper: '#FFFFFF',
  mist: '#F4F5F7', // app canvas / soft backgrounds
  fog: '#ECEDF0',
  line: '#E3E4E8', // hairlines
  line2: '#D5D7DC',
  mute: '#8A8D96', // secondary text
  mute2: '#5E616A',
  red: '#EC2A3A', // "now" — the only accent
  redSoft: 'rgba(236,42,58,0.12)',
};

export const FONT = {
  sans: '"Geist Variable", "Geist", system-ui, sans-serif',
  mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
};

// Display type defaults
export const DISPLAY = {
  fontFamily: FONT.sans,
  fontWeight: 560,
  letterSpacing: '-0.045em',
  lineHeight: 1,
  color: C.ink,
} as const;
