import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { BigButton } from '../components/BigButton';
import { Plant } from '../components/Plant';
import { colors, fonts, spacing } from '../theme';
import type { PlantMood, Progress } from '../types';

interface Props {
  progress: Progress;
  mood: PlantMood;
  wateredToday: boolean;
  onStart: () => void;
  onToggleVoice: (v: boolean) => void;
  onToggleHaptics: (v: boolean) => void;
}

const STATUS: Record<PlantMood, string> = {
  happy: 'Your plant is happy and watered.',
  thirsty: 'Your plant is a little thirsty.',
  wilted: 'Your plant missed you — let’s pick back up.',
};

/** Leaf/bloom look for the Home plant, derived from how it’s feeling. */
const LOOK: Record<PlantMood, { leaves: number; bloom: boolean }> = {
  happy: { leaves: 4, bloom: true },
  thirsty: { leaves: 3, bloom: false },
  wilted: { leaves: 2, bloom: false },
};

export function HomeScreen({
  progress,
  mood,
  wateredToday,
  onStart,
  onToggleVoice,
  onToggleHaptics,
}: Props) {
  const look = LOOK[mood];
  const filledDots = Math.min(progress.streak, 7);

  // Honour the OS "reduce motion" preference for the idle plant sway, and keep
  // it live so toggling the setting takes effect without a reload.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
    >
      <Text style={styles.title} accessibilityRole="header">
        Morning Watering
      </Text>

      <View style={styles.plantWrap}>
        <Plant leaves={look.leaves} bloom={look.bloom} mood={mood} reduceMotion={reduceMotion} />
      </View>

      <Text style={styles.status}>{STATUS[mood]}</Text>

      <View
        style={styles.streakRow}
        accessible
        accessibilityLabel={`Current streak: ${progress.streak} day${
          progress.streak === 1 ? '' : 's'
        }`}
      >
        <Text style={styles.streakNumber}>{progress.streak}</Text>
        <Text style={styles.streakLabel}>
          day{progress.streak === 1 ? '' : 's'} in a row
        </Text>
      </View>

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 7 }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < filledDots && styles.dotFilled]}
          />
        ))}
      </View>

      <BigButton
        label={wateredToday ? 'Water again' : 'Water your plant'}
        accessibilityHint="Starts a gentle two-minute stretching session"
        onPress={onStart}
        style={styles.cta}
      />
      {wateredToday && (
        <Text style={styles.doneNote}>
          You’ve already watered today — bonus stretches are always welcome.
        </Text>
      )}

      <View style={styles.settings}>
        <SettingRow
          label="Spoken coaching"
          value={progress.settings.voice}
          onChange={onToggleVoice}
        />
        <SettingRow
          label="Gentle vibration"
          value={progress.settings.haptics}
          onChange={onToggleHaptics}
        />
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        trackColor={{ true: colors.primary, false: '#C5CDD3' }}
        thumbColor={colors.paper}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sky },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: fonts.h1,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  plantWrap: { marginVertical: spacing.sm },
  status: {
    fontSize: fonts.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  streakRow: { flexDirection: 'row', alignItems: 'baseline' },
  streakNumber: {
    fontSize: fonts.display,
    fontWeight: '900',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  streakLabel: { fontSize: fonts.body, color: colors.inkSoft },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#C9DDEC',
  },
  dotFilled: { backgroundColor: colors.primary },
  cta: { marginTop: spacing.sm },
  doneNote: {
    fontSize: fonts.bodySmall,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  settings: {
    marginTop: spacing.xl,
    width: '100%',
    gap: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  settingLabel: { fontSize: fonts.bodySmall, color: colors.ink },
});
