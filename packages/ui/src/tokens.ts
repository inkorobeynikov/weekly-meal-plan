// Design tokens — "Plately" palette: forest green + lime accent on a clean,
// near-white green-tinted background. Thin type, lots of air, hairline borders.
// Source of truth: the design handoff bundle (see .design-ref/ and chat).
// All consumers must import from here; do not redeclare these values inline.

export const tokens = {
  // surfaces — clean whites, cool green-neutral tint (no warm beige)
  bg:        '#FBFCF6',
  surface:   '#FFFFFF',
  surface2:  '#EEF2E1', // cream-green chip / segmented-control track
  line:      'rgba(23, 37, 26, 0.09)',
  line2:     'rgba(23, 37, 26, 0.20)',

  // ink — deep forest greens, not warm browns
  ink:       '#17251A',
  ink2:      '#2F3D31',
  muted:     '#6B7464',
  faint:     '#9AA08E',

  // accents — "edible" palette, keys preserved so all screens keep compiling.
  // sage  = forest-green primary family
  // amber = lime accent family (kept name; now lime)
  // terra = warning / allergen red
  // blue  = calm info / leftovers (now a sage-teal)
  // plum  = berry / pink accent
  sage:      '#214D32',
  sageSoft:  '#EAF1DC',
  sageInk:   '#2C5A38',
  amber:     '#BCEA4F',
  amberSoft: '#EDF7CC',
  amberInk:  '#41611C',
  terra:     '#B23A2A',
  terraSoft: '#F6DCD4',
  terraInk:  '#8A2D1E',
  blue:      '#3E7E6E',
  blueSoft:  '#DCEDE6',
  blueInk:   '#2C5547',
  plum:      '#C25A86',
  plumSoft:  '#F7E0EA',
  plumInk:   '#9D3B6A',
} as const;

export const radii = { sm: 12, md: 14, lg: 18, xl: 26 } as const;

// Minimal / hairline. Cards rest on a 1px border; the shadow is barely there.
export const shadows = {
  card: '0 1px 2px rgba(30,45,25,0.05)',
  cardHighlight:
    '0 0 0 2px #214D32, 0 12px 32px -12px rgba(33,77,50,0.22)',
  sheet: '0 -12px 40px rgba(0,0,0,0.22)',
  fab: '0 6px 18px rgba(33,77,50,0.22)',
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
