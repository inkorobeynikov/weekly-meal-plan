import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fontSize, tokens } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  style,
}: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={[styles.row, style]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {actionLabel ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: tokens.ink,
  },
  action: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: tokens.sage,
  },
});
