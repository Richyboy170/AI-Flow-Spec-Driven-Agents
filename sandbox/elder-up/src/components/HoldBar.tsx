import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  /** 0..1 fraction of the hold completed. */
  progress: number;
  /** True while the hold is actively counting (tilt matched or button held). */
  active: boolean;
  /** Seconds remaining, for the large readout. */
  secondsLeft: number;
}

/**
 * Big, calm "watering" progress bar. A thick bar plus a large seconds readout
 * (PAT-3 allows a bar instead of a ring). The fill is water-blue and grows as
 * the hold is held; it pauses rather than resets when the user lets go.
 */
export function HoldBar({ progress, active, secondsLeft }: Props) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Stretch hold progress"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={styles.wrap}
    >
      <Text
        style={styles.seconds}
        maxFontSizeMultiplier={2}
        accessibilityLiveRegion="polite"
      >
        {active ? `${Math.ceil(secondsLeft)}s` : 'Hold to water'}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, opacity: active ? 1 : 0.6 },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  seconds: {
    fontSize: fonts.h2,
    fontWeight: '800',
    // Near-black ink for the readout: 13.3:1 on the sky background (was the
    // water blue at 2.78:1, which failed WCAG AA for large text).
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  track: {
    width: '100%',
    height: 28,
    borderRadius: radii.pill,
    // Darker track so the water fill reads as a distinct UI component.
    backgroundColor: colors.skyDeep,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.water,
  },
});
