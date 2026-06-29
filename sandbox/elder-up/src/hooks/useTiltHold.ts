import { useEffect, useRef, useState } from 'react';
import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import type { Stretch } from '../types';

interface TiltState {
  /** True while the phone is held in this stretch's target direction. */
  tilting: boolean;
  /** False if the device has no usable accelerometer (→ tap-along only). */
  sensorAvailable: boolean;
}

/**
 * Reads the accelerometer and reports whether the user is currently holding the
 * phone in `stretch`'s direction. This is the magic-feeling enhancement; it is
 * never required — SessionScreen always offers tap-and-hold in parallel, so a
 * missing or mis-tuned sensor degrades gracefully instead of blocking.
 */
export function useTiltHold(stretch: Stretch, enabled: boolean): TiltState {
  const [tilting, setTilting] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState(true);
  // Keep the latest predicate without re-subscribing every render.
  const matchRef = useRef(stretch.matchTilt);
  matchRef.current = stretch.matchTilt;

  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    if (!enabled) {
      setTilting(false);
      return;
    }

    (async () => {
      let available = true;
      try {
        available = await Accelerometer.isAvailableAsync();
      } catch {
        available = false;
      }
      if (cancelled) return;
      setSensorAvailable(available);
      if (!available) return;

      Accelerometer.setUpdateInterval(120);
      sub = Accelerometer.addListener((m: AccelerometerMeasurement) => {
        setTilting(matchRef.current(m));
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      setTilting(false);
    };
  }, [enabled, stretch.id]);

  return { tilting, sensorAvailable };
}
