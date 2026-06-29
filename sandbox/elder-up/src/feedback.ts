import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import type { Settings } from './types';

/**
 * Multi-channel coaching helpers. Every cue is meant to pair with on-screen
 * text, so audio + haptics are enhancements, never the sole channel. All calls
 * are guarded by the user's settings and swallow errors — feedback must never
 * crash a session (e.g. TTS unavailable, silent mode, no haptic motor).
 */

export function speak(text: string, settings: Settings): void {
  if (!settings.voice) return;
  try {
    Speech.stop();
    Speech.speak(text, { rate: 0.92, pitch: 1.0 });
  } catch {
    /* no-op */
  }
}

export function stopSpeech(): void {
  try {
    Speech.stop();
  } catch {
    /* no-op */
  }
}

export async function tapHaptic(settings: Settings): Promise<void> {
  if (!settings.haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* no-op */
  }
}

/** Gentle pulse confirming the hold is being counted. */
export async function holdHaptic(settings: Settings): Promise<void> {
  if (!settings.haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* no-op */
  }
}

/** Stronger celebratory burst at the end of a stretch / session. */
export async function successHaptic(settings: Settings): Promise<void> {
  if (!settings.haptics) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* no-op */
  }
}
