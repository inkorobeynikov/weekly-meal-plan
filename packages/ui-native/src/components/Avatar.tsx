import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { accentPair, tokens, type AccentTone } from '../tokens';

export type AvatarSize = 'sm' | 'md';

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  uri?: string;
  style?: StyleProp<ViewStyle>;
}

const dimensions: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 28, font: 12 },
  md: { box: 40, font: 16 },
};

// Accent tones rotated deterministically by name so each family member keeps a
// stable colour without needing an explicit tone prop.
const tonePalette: readonly AccentTone[] = ['sage', 'amber', 'terra', 'blue', 'plum'];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const first = words[0] ?? '';
    return first.slice(0, 1).toUpperCase() || '?';
  }
  const a = words[0]?.[0] ?? '';
  const b = words[words.length - 1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function toneOf(name: string): AccentTone {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % tonePalette.length;
  }
  return tonePalette[hash] ?? 'sage';
}

export function Avatar({ name, size = 'md', uri, style }: AvatarProps): React.JSX.Element {
  const dim = dimensions[size];
  const radius = dim.box / 2;
  const [softBg, inkColor] = accentPair[toneOf(name)];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityRole="image"
        accessibilityLabel={name}
        accessibilityIgnoresInvertColors
        style={
          [
            { width: dim.box, height: dim.box, borderRadius: radius, backgroundColor: tokens.surface2 },
            style,
          ] as StyleProp<ImageStyle>
        }
      />
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.circle,
        { width: dim.box, height: dim.box, borderRadius: radius, backgroundColor: softBg },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: dim.font, color: inkColor }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
});
