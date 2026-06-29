import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlantMood, Progress } from '../types';

const KEY = 'morning_watering_progress_v1';

export const DEFAULT_PROGRESS: Progress = {
  streak: 0,
  lastWateredISO: null,
  totalSessions: 0,
  settings: { voice: true, haptics: true },
};

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    // Merge defensively so older/partial records never crash the app.
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      settings: { ...DEFAULT_PROGRESS.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export async function saveProgress(p: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Local persistence is best-effort; a write failure should never block the
    // user's session. The streak simply won't advance this once.
  }
}

/** Midnight-aligned day index, so "yesterday vs today" ignores time of day. */
function dayNumber(iso: string): number {
  const d = new Date(iso);
  return Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000,
  );
}

/**
 * Apply a completed watering to progress. The streak advances once per day,
 * resets to 1 after a gap, and never breaks mid-day.
 */
export function recordWatering(p: Progress, nowISO: string): Progress {
  const today = dayNumber(nowISO);
  const last = p.lastWateredISO ? dayNumber(p.lastWateredISO) : null;

  let streak: number;
  if (last === null) streak = 1;
  else if (last === today) streak = Math.max(1, p.streak); // already watered today
  else if (today - last === 1) streak = p.streak + 1; // consecutive day
  else streak = 1; // gap — gently restart, plant never "dies"

  return {
    ...p,
    streak,
    lastWateredISO: nowISO,
    totalSessions: p.totalSessions + (last === today ? 0 : 1),
  };
}

/**
 * Plant mood from how long since the last watering. The plant wilts but never
 * dies — a missed day softens it; watering revives it instantly.
 */
export function moodFor(p: Progress, nowISO: string): PlantMood {
  if (!p.lastWateredISO) return 'thirsty';
  const gap = dayNumber(nowISO) - dayNumber(p.lastWateredISO);
  if (gap <= 0) return 'happy';
  if (gap === 1) return 'thirsty';
  return 'wilted';
}
