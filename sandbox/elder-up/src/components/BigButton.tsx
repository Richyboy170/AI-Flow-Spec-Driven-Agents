import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Defaults to the label. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one big, high-contrast, forgiving touch target used across the app.
 * Minimum height 72dp (well above the 64dp primary-action floor in theme).
 */
export function BigButton({
  label,
  onPress,
  onPressIn,
  onPressOut,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.base,
        variantStyle[variant],
        pressed && variantPressed[variant],
        disabled && styles.disabled,
        style,
      ]}
    >
      <View pointerEvents="none">
        <Text
          style={[styles.label, variant === 'secondary' && styles.labelDark]}
          maxFontSizeMultiplier={2.5}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 72,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabled: { opacity: 0.45 },
  label: {
    fontSize: fonts.button,
    fontWeight: '800',
    color: colors.paper,
    textAlign: 'center',
  },
  labelDark: { color: colors.ink },
});

const variantStyle: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.skyDeep },
  danger: { backgroundColor: colors.danger },
};

const variantPressed: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: '#BFE0F7' },
  danger: { backgroundColor: '#8E2E2E' },
};
