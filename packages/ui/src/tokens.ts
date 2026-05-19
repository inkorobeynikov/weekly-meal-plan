// Design tokens — warm-natural palette for the Weekly Mealplan family kitchen
// assistant. Source of truth: the design handoff bundle (see .design-ref/).
// All consumers must import from here; do not redeclare these values inline.

export const tokens = {
  // surfaces
  bg:        '#FBF7F1',
  surface:   '#FFFFFF',
  surface2:  '#F4EFE6',
  line:      'rgba(31, 27, 22, 0.08)',
  line2:     'rgba(31, 27, 22, 0.14)',

  // ink
  ink:       '#1F1B16',
  ink2:      '#4A4239',
  muted:     '#7A6F62',
  faint:     '#A89E91',

  // accents — same chroma/lightness family, varied hue
  sage:      '#6E8C5A',
  sageSoft:  '#E7EFDD',
  sageInk:   '#3F5733',
  amber:     '#C8761F',
  amberSoft: '#F8E9D2',
  amberInk:  '#8A4F12',
  terra:     '#B5482F',
  terraSoft: '#F4D9CF',
  terraInk:  '#7E2D1A',
  blue:      '#3F6E89',
  blueSoft:  '#DDE8EF',
  blueInk:   '#2A4D63',
  plum:      '#7A4E6B',
  plumSoft:  '#EEDDE7',
  plumInk:   '#5C3550',
} as const;

export const radii = { sm: 10, md: 14, lg: 20, xl: 28 } as const;

export const shadows = {
  card: '0 1px 0 rgba(31,27,22,0.04), 0 8px 24px -12px rgba(31,27,22,0.10)',
  cardHighlight:
    '0 0 0 2px #1F1B16, 0 12px 32px -12px rgba(31,27,22,0.18)',
  sheet: '0 -12px 40px rgba(31,27,22,0.18)',
  fab: '0 10px 28px -8px rgba(31,27,22,0.45)',
} as const;

// Accent tone → [softBg, inkColor]. Used by Iconchip, Badge, etc.
export type AccentTone = 'sage' | 'amber' | 'terra' | 'blue' | 'plum';
export const accentPair: Record<AccentTone, readonly [string, string]> = {
  sage:  [tokens.sageSoft, tokens.sageInk],
  amber: [tokens.amberSoft, tokens.amberInk],
  terra: [tokens.terraSoft, tokens.terraInk],
  blue:  [tokens.blueSoft, tokens.blueInk],
  plum:  [tokens.plumSoft, tokens.plumInk],
};

export type Tokens = typeof tokens;
