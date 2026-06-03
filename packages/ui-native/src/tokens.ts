// Design tokens — "Plately" palette: forest green + lime accent on a clean,
// near-white green-tinted background. React Native mirror of
// `packages/ui/src/tokens.ts` (web source of truth). Values are copied verbatim
// so the native and web design systems stay visually identical. All native
// consumers must import from here; do not redeclare these values inline.

import type { ViewStyle } from 'react-native';

export const tokens = {
  // surfaces — clean whites, cool green-neutral tint (no warm beige)
  bg:        '#FBFCF6',
  surface:   '#FFFFFF',
  surface2:  '#EEF2E1',
  line:      'rgba(23, 37, 26, 0.09)',
  line2:     'rgba(23, 37, 26, 0.20)',

  // ink — deep forest greens, not warm browns
  ink:       '#17251A',
  ink2:      '#2F3D31',
  muted:     '#6B7464',
  faint:     '#9AA08E',

  // accents — "edible" palette, keys preserved (sage = forest primary,
  // amber = lime accent, terra = allergen red, blue = sage-teal, plum = berry)
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

// Raw web box-shadow strings, kept for reference / parity documentation. These
// CSS strings are NOT directly consumable by React Native — use `shadowStyle`
// below for actual RN styling.
export const shadows = {
  card: '0 1px 2px rgba(30,45,25,0.05)',
  cardHighlight:
    '0 0 0 2px #214D32, 0 12px 32px -12px rgba(33,77,50,0.22)',
  sheet: '0 -12px 40px rgba(0,0,0,0.22)',
  fab: '0 6px 18px rgba(33,77,50,0.22)',
} as const;

// React Native shadow style objects approximating the web box-shadows above.
// RN cannot represent multi-layer shadows or spread/inset, so these pick
// sensible single-layer values (iOS shadow* props + Android elevation).
// Minimal / hairline to match the airy redesign — cards rest on their border.
export const shadowStyle = {
  card: {
    shadowColor: '#1E2D19',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHighlight: {
    shadowColor: '#214D32',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  fab: {
    shadowColor: '#214D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;

// Accent tone → [softBg, inkColor]. Used by Badge, Tag, Avatar, etc.
export type AccentTone = 'sage' | 'amber' | 'terra' | 'blue' | 'plum';
export const accentPair: Record<AccentTone, readonly [string, string]> = {
  sage:  [tokens.sageSoft, tokens.sageInk],
  amber: [tokens.amberSoft, tokens.amberInk],
  terra: [tokens.terraSoft, tokens.terraInk],
  blue:  [tokens.blueSoft, tokens.blueInk],
  plum:  [tokens.plumSoft, tokens.plumInk],
};

// Spacing scale (pt). Mirrors the 4-based rhythm used across the web mockups.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

// Font-size scale derived from the W04/W05/W08 type ramp in the design mockup.
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 20,
  xl: 24,
  display: 30,
} as const;

export type Tokens = typeof tokens;
export type Spacing = typeof spacing;
export type FontSize = typeof fontSize;
export type ShadowStyle = typeof shadowStyle;
