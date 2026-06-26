/** Shared types for Morning Watering. */

import type { AccelerometerMeasurement } from 'expo-sensors';

/** A single guided stretch ("watering"). */
export interface Stretch {
  id: string;
  /** Short title, e.g. "Reach Up". */
  name: string;
  /** Spoken + on-screen coaching cue. */
  cue: string;
  /** Plain instruction shown under the cue. */
  instruction: string;
  /** Seated-friendly variant note. */
  seatedNote: string;
  /** Seconds the hold must accumulate to count as complete. */
  holdSeconds: number;
  /**
   * Returns true when the live accelerometer reading indicates the user is
   * holding the phone in this stretch's target direction. Deliberately
   * forgiving; thresholds are meant to be tuned on a real device.
   */
  matchTilt: (m: AccelerometerMeasurement) => boolean;
  /** Which way the on-screen plant visibly reaches while drinking. */
  reach: 'up' | 'left' | 'right' | 'forward';
  /** True when raising the arm turns the screen away (audio-primary mode). */
  screenMayFaceAway?: boolean;
}

/** Plant mood derived from how recently it was watered. */
export type PlantMood = 'happy' | 'thirsty' | 'wilted';

export interface Settings {
  voice: boolean;
  haptics: boolean;
}

/** Persisted progress (see storage/progress.ts). */
export interface Progress {
  streak: number;
  lastWateredISO: string | null;
  totalSessions: number;
  settings: Settings;
}

/** Top-level screen the app is showing. */
export type Screen = 'home' | 'pre' | 'session';
