import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BigButton } from '../components/BigButton';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  onStart: (seated: boolean) => void;
  onBack: () => void;
}

/** Calm pre-flight: how long, seated or standing, and a gentle safety line. */
export function PreSessionScreen({ onStart, onBack }: Props) {
  const [seated, setSeated] = useState(true); // seated is the default

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Let’s water your plant
      </Text>
      <Text style={styles.lead}>
        This takes about two minutes. Four gentle stretches — tilt your phone, or
        just hold the button. You can sit the whole time.
      </Text>

      <Text style={styles.choiceLabel} nativeID="positionLabel">
        How would you like to do it?
      </Text>
      <View
        style={styles.choices}
        accessibilityRole="radiogroup"
        accessibilityLabel="Workout position"
      >
        <Choice
          label="Sitting"
          selected={seated}
          onPress={() => setSeated(true)}
        />
        <Choice
          label="Standing"
          selected={!seated}
          onPress={() => setSeated(false)}
        />
      </View>

      <Text style={styles.safety}>
        Move only as far as feels comfortable. Stop any moment if something hurts.
      </Text>

      <View style={styles.actions}>
        <BigButton
          label="Start"
          accessibilityHint="Begins the first gentle stretch"
          onPress={() => onStart(seated)}
        />
        <BigButton
          label="Not now"
          variant="secondary"
          accessibilityHint="Returns to the home screen"
          onPress={onBack}
        />
      </View>
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sky,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: fonts.h1,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  lead: {
    fontSize: fonts.body,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: fonts.body * 1.4,
    marginBottom: spacing.lg,
  },
  choiceLabel: {
    fontSize: fonts.bodySmall,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  choice: {
    flex: 1,
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: '#C9DDEC',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E4F3EA',
  },
  choiceText: { fontSize: fonts.button, fontWeight: '700', color: colors.inkSoft },
  choiceTextSelected: { color: colors.primary },
  safety: {
    fontSize: fonts.bodySmall,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actions: { gap: spacing.md },
});
