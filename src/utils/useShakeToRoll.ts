import { useEffect, useRef } from 'react';

// Single switch to kill the whole feature without touching any call site.
export const SHAKE_TO_ROLL_ENABLED = true;

// Delta (m/s²) between consecutive accelerometer readings that counts as a shake.
const SHAKE_THRESHOLD = 18;
// Minimum gap between two shake triggers, as a backstop against the caller
// not disabling `enabled` fast enough after the first shake fires.
const COOLDOWN_MS = 800;

/**
 * Calls `onShake` once when the device is shaken, but only while `enabled`
 * is true. Callers must flip `enabled` off as soon as the roll starts (e.g.
 * once `rolling` becomes true), so a single energetic shake can't queue up
 * extra rolls — the dice button must appear again before another shake works.
 */
export function useShakeToRoll(enabled: boolean, onShake: () => void): void {
  const lastMagnitude = useRef<number | null>(null);
  const lastShakeAt = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!SHAKE_TO_ROLL_ENABLED || !enabled) return;
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;

    lastMagnitude.current = null;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

      const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

      if (lastMagnitude.current !== null) {
        const delta = Math.abs(magnitude - lastMagnitude.current);
        const now = Date.now();
        if (delta > SHAKE_THRESHOLD && now - lastShakeAt.current > COOLDOWN_MS) {
          lastShakeAt.current = now;
          onShakeRef.current();
        }
      }

      lastMagnitude.current = magnitude;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled]);
}

/**
 * iOS 13+ requires an explicit, gesture-triggered permission request before
 * `devicemotion` events fire at all. Call this from a button's onClick (a
 * settings/help toggle, say) — it's a no-op resolving true on browsers that
 * don't gate the API (Android, desktop).
 */
export async function requestShakeToRollPermission(): Promise<boolean> {
  const DeviceMotionEventWithPermission = window.DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  if (typeof DeviceMotionEventWithPermission?.requestPermission !== 'function') {
    return true;
  }

  try {
    return (await DeviceMotionEventWithPermission.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
