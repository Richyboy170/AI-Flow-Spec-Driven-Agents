import type { Stretch } from '../types';

/**
 * The four "waterings" of a Morning Watering session.
 *
 * matchTilt thresholds are intentionally forgiving and use a single dominant
 * axis per stretch so different movements do not trigger one another. They are
 * first guesses meant to be TUNED ON A REAL DEVICE — the tap-and-hold path is
 * the guaranteed way to complete a stretch, so a mis-tuned sensor never blocks
 * a session. Accelerometer values are in g (gravity included).
 */
export const STRETCHES: Stretch[] = [
  {
    id: 'reach-up',
    name: 'Reach Up',
    cue: 'Reach up — like offering water to the sky.',
    instruction: 'Lift the phone up and gently hold it there.',
    seatedNote: 'Sitting tall is perfect — just raise your arm as you can.',
    holdSeconds: 8,
    reach: 'up',
    screenMayFaceAway: true,
    matchTilt: (m) => m.y > 0.55 && Math.abs(m.x) < 0.5,
  },
  {
    id: 'lean-left',
    name: 'Lean Left',
    cue: 'Lean gently to the left.',
    instruction: 'Tilt the phone to your left and hold.',
    seatedNote: 'Stay seated and lean only as far as feels easy.',
    holdSeconds: 8,
    reach: 'left',
    matchTilt: (m) => m.x < -0.4,
  },
  {
    id: 'lean-right',
    name: 'Lean Right',
    cue: 'Now lean gently to the right.',
    instruction: 'Tilt the phone to your right and hold.',
    seatedNote: 'Stay seated and lean only as far as feels easy.',
    holdSeconds: 8,
    reach: 'right',
    matchTilt: (m) => m.x > 0.4,
  },
  {
    id: 'reach-forward',
    name: 'Reach Forward',
    cue: 'Reach forward — pour the last of the water.',
    instruction: 'Tilt the phone forward, away from you, and hold.',
    seatedNote: 'A small forward reach from your chair is plenty.',
    holdSeconds: 8,
    reach: 'forward',
    matchTilt: (m) => m.z > 0.5,
  },
];

/** A partial hold this long still counts as a full watering (forgiveness). */
export const MIN_HOLD_CREDIT_RATIO = 0.75;
