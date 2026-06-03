import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fontSize, radii, spacing, tokens } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  // Optional stable selector for E2E (Maestro) automation. Maps to
  // accessibilityIdentifier (iOS) / view tag (Android) on the underlying
  // Pressable; purely additive and inert in normal rendering.
  testID?: string;
}

const sizeStyles: Record<ButtonSize, { paddingV: number; paddingH: number; font: number }> = {
  sm: { paddingV: spacing.sm, paddingH: spacing.md, font: fontSize.sm },
  md: { paddingV: spacing.md, paddingH: spacing.lg, font: fontSize.base },
  lg: { paddingV: spacing.lg, paddingH: spacing.xl, font: fontSize.lg },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  const sz = sizeStyles[size];

  const variantContainer: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: tokens.sage }
      : variant === 'secondary'
        ? { backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.line2 }
        : { backgroundColor: 'transparent' };

  const textColor =
    variant === 'primary' ? tokens.surface : tokens.ink;
  const spinnerColor = variant === 'primary' ? tokens.surface : tokens.ink;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        { paddingVertical: sz.paddingV, paddingHorizontal: sz.paddingH },
        variantContainer,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={spinnerColor} />
        </View>
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize: sz.font }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
