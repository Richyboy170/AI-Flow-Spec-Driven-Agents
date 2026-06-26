import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { HomeScreen } from './src/screens/HomeScreen';
import { PreSessionScreen } from './src/screens/PreSessionScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import {
  loadProgress,
  moodFor,
  recordWatering,
  saveProgress,
} from './src/storage/progress';
import { colors, fonts } from './src/theme';
import type { Progress, Screen } from './src/types';

/**
 * Root state machine for Morning Watering.
 *
 * Owns: which screen is showing, the loaded Progress, and the seated/standing
 * choice carried from the pre-session screen into the session. Mood and
 * "watered today" are derived from Progress so they always agree with the
 * midnight-aligned day logic in storage/progress.ts (no separate date math here).
 */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [seated, setSeated] = useState(true); // seated is the gentle default

  // Load persisted progress once on mount.
  useEffect(() => {
    let alive = true;
    loadProgress()
      .then((p) => {
        if (alive) setProgress(p);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const nowISO = new Date().toISOString();

  // Derived plant state — kept consistent with storage's day logic.
  const mood = useMemo(
    () => (progress ? moodFor(progress, nowISO) : 'thirsty'),
    [progress, nowISO],
  );
  // Watered-today iff there is a timestamp and the gap is 0 days (mood 'happy').
  const wateredToday = !!progress?.lastWateredISO && mood === 'happy';

  // Persist a settings change immediately (best-effort; save swallows errors).
  const updateSettings = useCallback(
    (patch: Partial<Progress['settings']>) => {
      setProgress((prev) => {
        if (!prev) return prev;
        const next: Progress = {
          ...prev,
          settings: { ...prev.settings, ...patch },
        };
        void saveProgress(next);
        return next;
      });
    },
    [],
  );

  // Session finished: record a watering when at least one stretch was held.
  const handleSessionDone = useCallback((completed: number) => {
    if (completed >= 1) {
      setProgress((prev) => {
        if (!prev) return prev;
        const next = recordWatering(prev, new Date().toISOString());
        void saveProgress(next);
        return next;
      });
    }
    setScreen('home');
  }, []);

  let body: React.ReactNode;
  if (loading || !progress) {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Waking up your plant"
        />
        <Text style={styles.loadingText}>Waking up your plant…</Text>
      </View>
    );
  } else if (screen === 'pre') {
    body = (
      <PreSessionScreen
        onStart={(s) => {
          setSeated(s);
          setScreen('session');
        }}
        onBack={() => setScreen('home')}
      />
    );
  } else if (screen === 'session') {
    body = (
      <SessionScreen
        settings={progress.settings}
        seated={seated}
        onDone={handleSessionDone}
      />
    );
  } else {
    body = (
      <HomeScreen
        progress={progress}
        mood={mood}
        wateredToday={wateredToday}
        onStart={() => setScreen('pre')}
        onToggleVoice={(v) => updateSettings({ voice: v })}
        onToggleHaptics={(v) => updateSettings({ haptics: v })}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: fonts.body,
    color: colors.inkSoft,
  },
});
