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
import { Tag } from './Tag';

export interface MealCardBadge {
  tone?: AccentTone;
  label: string;
}

export interface MealCardProps {
  name: string;
  imageUri?: string;
  cookTimeMinutes?: number;
  portions?: number;
  badges?: MealCardBadge[];
  onPress?: () => void;
  onSwap?: () => void;
  style?: StyleProp<ViewStyle>;
}

// The primary meal card used across the W04/W05/W07 screens: photo, dish name,
// cook-time + portions tags, optional dietary badges and an optional swap
// affordance. All user-facing text is Polish.
export function MealCard({
  name,
  imageUri,
  cookTimeMinutes,
  portions,
  badges,
  onPress,
  onSwap,
  style,
}: MealCardProps): React.JSX.Element {
  const inner = (
    <>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.photo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]} />
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {onSwap ? (
            <Pressable
              onPress={onSwap}
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
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[styles.card, style]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={name} style={[styles.card, style]}>
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
  photoPlaceholder: {
    backgroundColor: tokens.surface2,
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
