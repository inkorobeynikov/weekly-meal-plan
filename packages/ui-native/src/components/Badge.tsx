import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { accentPair, fontSize, type AccentTone } from '../tokens';

export interface BadgeProps {
  tone?: AccentTone;
  label: string;
  style?: StyleProp<ViewStyle>;
}

// Convenience map: known dietary tag → accent tone. Keys are lower-cased and
// cover both English and Polish labels used across the app.
const dietToneMap: Record<string, AccentTone> = {
  vegetarian: 'sage',
  wegetariańskie: 'sage',
  vegan: 'sage',
  wegańskie: 'sage',
  'gluten-free': 'amber',
  bezglutenowe: 'amber',
  'dairy-free': 'amber',
  bezlaktozowe: 'amber',
  spicy: 'terra',
  pikantne: 'terra',
  'kid-ok': 'plum',
  'dla-dzieci': 'plum',
  fish: 'blue',
  ryba: 'blue',
};

function resolveTone(label: string, tone?: AccentTone): AccentTone {
  if (tone) return tone;
  return dietToneMap[label.trim().toLowerCase()] ?? 'sage';
}

export function Badge({ tone, label, style }: BadgeProps): React.JSX.Element {
  const resolved = resolveTone(label, tone);
  const [softBg, inkColor] = accentPair[resolved];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: softBg }, style]}
    >
      <Text style={[styles.label, { color: inkColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
