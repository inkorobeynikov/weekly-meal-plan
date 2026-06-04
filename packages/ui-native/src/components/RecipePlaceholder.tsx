// RecipePlaceholder — a deterministic, attractive colored card that replaces the
// gray blank placeholder shown when a recipe has no photo. The background color
// and glyph are derived purely from the seed (recipe name or category) via a
// simple DJB2-style hash → hue mapping constrained to the Plately palette. The
// same seed always produces the same visual; no Math.random is used.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, tokens, type AccentTone } from '../tokens';

// ---------------------------------------------------------------------------
// Palette — six pleasant accent pairs drawn from tokens, all in the green/lime
// family or complementary earthy tones. Ordered so the hash distributes across
// them evenly.
// ---------------------------------------------------------------------------

const PALETTE: ReadonlyArray<{
  tone: AccentTone;
  bg: string;
  fg: string;
  glyph: string;
}> = [
  { tone: 'sage',  bg: tokens.sageSoft,  fg: tokens.sageInk,  glyph: '🥗' },
  { tone: 'amber', bg: tokens.amberSoft, fg: tokens.amberInk, glyph: '🌿' },
  { tone: 'blue',  bg: tokens.blueSoft,  fg: tokens.blueInk,  glyph: '🥘' },
  { tone: 'plum',  bg: tokens.plumSoft,  fg: tokens.plumInk,  glyph: '🫐' },
  { tone: 'sage',  bg: '#D4EDBC',        fg: tokens.sageInk,  glyph: '🥦' },
  { tone: 'amber', bg: '#EAF5A2',        fg: tokens.amberInk, glyph: '🌾' },
];

// ---------------------------------------------------------------------------
// Hash — deterministic DJB2-style. Produces an unsigned 32-bit integer.
// ---------------------------------------------------------------------------

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash = hash * 33 ^ charCode  (unsigned 32-bit via >>> 0)
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Pick a palette entry deterministically from the seed.
function paletteForSeed(seed: string): (typeof PALETTE)[number] {
  const idx = djb2Hash(seed.toLowerCase().trim()) % PALETTE.length;
  return PALETTE[idx] ?? PALETTE[0]!;
}

// Derive 1- or 2-letter initials from the seed (used as a fallback text overlay
// inside the colored card — visible when emoji rendering fails or is clipped).
function initialsFromSeed(seed: string): string {
  const words = seed.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0]!.slice(0, 2)).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface RecipePlaceholderProps {
  /** Recipe name or category — must be stable per dish. */
  seed: string;
  /** Rendered size; defaults to 140 (matches MealCard photo height). */
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function RecipePlaceholder({
  seed,
  height = 140,
  style,
  testID,
}: RecipePlaceholderProps): React.JSX.Element {
  const entry = paletteForSeed(seed);
  const initials = initialsFromSeed(seed);

  return (
    <View
      testID={testID}
      accessibilityLabel={`Placeholder dla ${seed}`}
      style={[
        styles.container,
        { height, backgroundColor: entry.bg, borderRadius: radii.md },
        style,
      ]}
    >
      {/* Large food glyph centred in the card */}
      <Text style={styles.glyph}>{entry.glyph}</Text>
      {/* Dish initials below the glyph — adds personality + is accessible */}
      <Text style={[styles.initials, { color: entry.fg }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  glyph: {
    fontSize: 48,
    lineHeight: 56,
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.7,
  },
});
