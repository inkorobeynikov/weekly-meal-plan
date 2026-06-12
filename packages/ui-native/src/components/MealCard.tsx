import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fontSize, radii, shadowStyle, tokens, type AccentTone } from '../tokens';
import { Badge } from './Badge';
import { RecipePlaceholder } from './RecipePlaceholder';
import { Tag } from './Tag';

export interface MealCardBadge {
  tone?: AccentTone;
  label: string;
}

export interface MealCardProps {
  name: string;
  imageUri?: string;
  /** Stable seed for the deterministic placeholder (recipe name or category).
   *  Defaults to `name` when omitted so existing callers are unaffected. */
  placeholderSeed?: string;
  cookTimeMinutes?: number;
  portions?: number;
  badges?: MealCardBadge[];
  onPress?: () => void;
  onSwap?: () => void;
  style?: StyleProp<ViewStyle>;
  // Optional stable selector for E2E (Maestro) automation on the outer card.
  testID?: string;
  // Optional stable selector for the inline swap affordance.
  swapTestID?: string;
}

// The primary meal card used across the W04/W05/W07 screens: photo, dish name,
// cook-time + portions tags, optional dietary badges and an optional swap
// affordance. All user-facing text is Polish.
export function MealCard({
  name,
  imageUri,
  placeholderSeed,
  cookTimeMinutes,
  portions,
  badges,
  onPress,
  onSwap,
  style,
  testID,
  swapTestID,
}: MealCardProps): React.JSX.Element {
  const seed = placeholderSeed ?? name;

  const inner = (
    <>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <RecipePlaceholder seed={seed} height={140} style={styles.photo} />
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {onSwap ? (
            <Pressable
              onPress={onSwap}
              testID={swapTestID}
              accessibilityRole="button"
              accessibilityLabel="Zamień posiłek"
              hitSlop={8}
              style={styles.swap}
            >
              <Text style={styles.swapGlyph}>↺</Text>
            </Pressable>
          ) : null}
        </View>

        {(cookTimeMinutes !== undefined || portions !== undefined) && (
          <View style={styles.metaRow}>
            {cookTimeMinutes !== undefined ? (
              <Tag label={`${cookTimeMinutes} min`} />
            ) : null}
            {portions !== undefined ? <Tag label={`${portions} porcji`} /> : null}
          </View>
        )}

        {badges && badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((b, i) => (
              <Badge key={`${b.label}-${i}`} tone={b.tone} label={b.label} />
            ))}
          </View>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[styles.card, style]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={name} style={[styles.card, style]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadowStyle.card,
  },
  photo: {
    width: '100%',
    height: 140,
  },
  body: {
    padding: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: tokens.ink,
    lineHeight: 24,
  },
  swap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface2,
  },
  swapGlyph: {
    fontSize: 18,
    color: tokens.ink2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
