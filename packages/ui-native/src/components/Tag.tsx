import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fontSize, tokens } from '../tokens';

export interface TagProps {
  icon?: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
}

// Small pill with an optional leading icon + text. Used for cook time and
// portions metadata. The icon is an opaque ReactNode supplied by the caller so
// this package does not hard-depend on any vector-icons library.
export function Tag({ icon, label, style }: TagProps): React.JSX.Element {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.tag, style]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: tokens.surface2,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: tokens.ink2,
  },
});
