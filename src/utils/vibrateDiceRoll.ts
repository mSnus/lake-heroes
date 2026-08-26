// Single switch to kill the whole feature without touching any call site.
export const DICE_VIBRATION_ENABLED = true;

const PULSE_MS = 60;
const PAUSE_MS = 40;
const PULSE_COUNT = 12;

/**
 * Fires a short vibration burst (5 x 30ms pulses, 50ms apart) when a dice
 * roll starts. No-op on browsers without the Vibration API (notably iOS Safari).
 */
export function vibrateDiceRoll(): void {
  if (!DICE_VIBRATION_ENABLED) {
    console.debug('[vibrate] disabled via DICE_VIBRATION_ENABLED');
    return;
  }

  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    console.debug('[vibrate] navigator.vibrate is not available in this browser');
    return;
  }

  const pattern: number[] = [];
  for (let i = 0; i < PULSE_COUNT; i++) {
    if (i > 0) pattern.push(PAUSE_MS);
    pattern.push(PULSE_MS * (Math.random()+1));
  }

  // navigator.vibrate() returns false if the browser rejected the request
  // (e.g. no active user-gesture window) — log it so this is diagnosable
  // from a remote-debugged device instead of guessing blind.
  const accepted = navigator.vibrate(pattern);
  console.debug('[vibrate] navigator.vibrate(): accepted =', accepted, 'pattern =', pattern);
}
