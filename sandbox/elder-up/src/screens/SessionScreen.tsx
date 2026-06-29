import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton } from '../components/BigButton';
import { HoldBar } from '../components/HoldBar';
import { Plant } from '../components/Plant';
import { STRETCHES } from '../data/stretches';
import { useTiltHold } from '../hooks/useTiltHold';
import {
  holdHaptic,
  speak,
  stopSpeech,
  successHaptic,
  tapHaptic,
} from '../feedback';
import { colors, fonts, spacing } from '../theme';
import type { Settings } from '../types';

type Phase = 'warmup' | 'stretch' | 'rest' | 'finish';

const TICK_MS = 100;
const REST_MS = 4000;

interface Props {
  settings: Settings;
  seated: boolean;
  /** Called when the session ends; count = stretches completed (0..4). */
  onDone: (completed: number) => void;
}

export function SessionScreen({ settings, seated, onDone }: Props) {
  useKeepAwake(); // screen stays on through the gentle session

  const [phase, setPhase] = useState<Phase>('warmup');
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [progress, setProgress] = useState(0); // seconds held this stretch
  const [pressed, setPressed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const stretch = STRETCHES[index];
  const { tilting, sensorAvailable } = useTiltHold(stretch, phase === 'stretch');
  const active = phase === 'stretch' && (pressed || tilting);

  const activeRef = useRef(active);
  activeRef.current = active;
  const completingRef = useRef(false);
  const prevActiveRef = useRef(false);

  // Honour the OS "reduce motion" preference.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Pause cleanly if the app is backgrounded (call, lock screen).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        stopSpeech();
        setPressed(false);
      }
    });
    return () => sub.remove();
  }, []);

  // Entering a stretch: announce it, reset the hold.
  useEffect(() => {
    if (phase !== 'stretch') return;
    completingRef.current = false;
    setProgress(0);
    setPressed(false);
    tapHaptic(settings);
    speak(stretch.cue, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  // Accumulate held time while active (tilt matched OR button held).
  useEffect(() => {
    if (phase !== 'stretch') return;
    const id = setInterval(() => {
      if (activeRef.current) setProgress((p) => p + TICK_MS / 1000);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, index]);

  // Gentle pulse + encouragement the moment the hold starts counting.
  useEffect(() => {
    if (phase !== 'stretch') return;
    if (active && !prevActiveRef.current) {
      holdHaptic(settings);
      speak(stretch.screenMayFaceAway ? 'Hold it there — you’re doing it.' : 'Hold it.', settings);
    }
    prevActiveRef.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase]);

  // Complete the stretch when the hold target is reached.
  useEffect(() => {
    if (phase !== 'stretch' || completingRef.current) return;
    if (progress >= stretch.holdSeconds) {
      completingRef.current = true;
      const next = completed + 1;
      setCompleted(next);
      successHaptic(settings);
      speak('Beautiful.', settings);
      const last = index >= STRETCHES.length - 1;
      setPhase(last ? 'finish' : 'rest');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, phase]);

  // Auto-advance after a calm rest beat (still interruptible by the buttons).
  useEffect(() => {
    if (phase !== 'rest') return;
    const id = setTimeout(() => {
      setIndex((i) => i + 1);
      setPhase('stretch');
    }, REST_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Speak the reward line once when we reach the finish screen.
  useEffect(() => {
    if (phase !== 'finish') return;
    successHaptic(settings);
    speak(
      stopped
        ? 'Well done for moving today. Your plant noticed.'
        : 'Your plant is happy. See you tomorrow.',
      settings,
    );
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function stopForToday() {
    stopSpeech();
    setStopped(true);
    setPhase('finish');
  }

  // ---- Renders ---------------------------------------------------------

  if (phase === 'warmup') {
    return (
      <View style={styles.screen}>
        <Plant leaves={0} mood="thirsty" bloom={false} reduceMotion={reduceMotion} />
        <Text style={styles.cue} accessibilityRole="header">
          Let’s begin with a slow breath
        </Text>
        <Text style={styles.sub}>
          Breathe in… and gently out. When you’re ready, let’s water your plant.
        </Text>
        <BigButton label="I’m ready" onPress={() => setPhase('stretch')} />
      </View>
    );
  }

  if (phase === 'rest') {
    const next = STRETCHES[index + 1];
    return (
      <View style={styles.screen}>
        <Plant
          leaves={completed}
          mood="happy"
          bloom={false}
          reduceMotion={reduceMotion}
        />
        <Text style={styles.cue}>Lovely. Take a rest.</Text>
        {next && <Text style={styles.sub}>Next up: {next.name}</Text>}
        <View style={styles.actions}>
          <BigButton
            label="Continue"
            onPress={() => {
              setIndex((i) => i + 1);
              setPhase('stretch');
            }}
          />
          <BigButton label="I’m done for today" variant="secondary" onPress={stopForToday} />
        </View>
      </View>
    );
  }

  if (phase === 'finish') {
    return (
      <View style={styles.screen}>
        <Plant
          leaves={Math.max(completed, 1)}
          mood="happy"
          bloom={completed >= STRETCHES.length}
          reduceMotion={reduceMotion}
        />
        <Text style={styles.cue} accessibilityRole="header">
          {stopped ? 'Well done for moving today' : 'Your plant is happy'}
        </Text>
        <Text style={styles.sub}>
          You held {completed} stretch{completed === 1 ? '' : 'es'}
          {completed >= STRETCHES.length ? ' — a full morning watering.' : '.'} Your
          plant noticed.
        </Text>
        <BigButton label="Done" onPress={() => onDone(completed)} />
      </View>
    );
  }

  // phase === 'stretch'
  const seconds = Math.max(0, stretch.holdSeconds - progress);
  return (
    <View style={styles.screen}>
      <Text style={styles.step}>
        Stretch {index + 1} of {STRETCHES.length}
      </Text>

      <Plant
        leaves={completed}
        mood="happy"
        bloom={false}
        drinking={active}
        reach={stretch.reach}
        reduceMotion={reduceMotion}
      />

      <Text style={styles.cue} accessibilityRole="header">
        {stretch.cue}
      </Text>
      <Text style={styles.sub}>
        {seated ? stretch.seatedNote : stretch.instruction}
      </Text>

      <HoldBar progress={progress / stretch.holdSeconds} active={active} secondsLeft={seconds} />

      <Text style={styles.help}>
        {sensorAvailable
          ? 'Tilt your phone and hold — or press and hold the button below.'
          : 'Press and hold the button below to water.'}
      </Text>

      <View style={styles.actions}>
        <BigButton
          label="Hold to water"
          accessibilityHint="Press and hold while you hold the stretch"
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
        />
        <BigButton label="I’m done for today" variant="secondary" onPress={stopForToday} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sky,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  step: { fontSize: fonts.bodySmall, color: colors.inkSoft, fontWeight: '700' },
  cue: {
    fontSize: fonts.h2,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sub: {
    fontSize: fonts.body,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: fonts.body * 1.35,
    marginBottom: spacing.sm,
  },
  help: {
    fontSize: fonts.bodySmall,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actions: { width: '100%', gap: spacing.md, marginTop: spacing.sm },
});
