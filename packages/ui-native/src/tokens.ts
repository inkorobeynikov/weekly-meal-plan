// Design tokens — warm-natural palette for the Weekly Mealplan family kitchen
// assistant. React Native mirror of `packages/ui/src/tokens.ts` (web source of
// truth). Values are copied verbatim so the native and web design systems stay
// visually identical. All native consumers must import from here; do not
// redeclare these values inline.

import type { ViewStyle } from 'react-native';

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

// Raw web box-shadow strings, kept for reference / parity documentation. These
// CSS strings are NOT directly consumable by React Native — use `shadowStyle`
// below for actual RN styling.
export const shadows = {
  card: '0 1px 0 rgba(31,27,22,0.04), 0 8px 24px -12px rgba(31,27,22,0.10)',
  cardHighlight:
    '0 0 0 2px #1F1B16, 0 12px 32px -12px rgba(31,27,22,0.18)',
  sheet: '0 -12px 40px rgba(31,27,22,0.18)',
  fab: '0 10px 28px -8px rgba(31,27,22,0.45)',
} as const;

// React Native shadow style objects approximating the web box-shadows above.
// RN cannot represent multi-layer shadows or spread/inset, so these pick
// sensible single-layer values (iOS shadow* props + Android elevation).
export const shadowStyle = {
  card: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHighlight: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  sheet: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  fab: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
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
