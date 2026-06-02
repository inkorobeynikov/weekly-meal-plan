import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radii, shadowStyle, tokens } from '../tokens';

export interface CardProps {
  thumbnailUri?: string;
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({
  thumbnailUri,
  children,
  onPress,
  style,
  accessibilityLabel,
}: CardProps): React.JSX.Element {
  const content = (
    <>
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={styles.thumbnail}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.body}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.card, style]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {content}
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
  thumbnail: {
    width: '100%',
    height: 140,
    backgroundColor: tokens.surface2,
  },
  body: {
    padding: 14,
  },
});
