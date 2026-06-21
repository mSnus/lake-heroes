// Single switch to kill the whole feature without touching any call site.
export const DICE_VIBRATION_ENABLED = true;

const PULSE_MS = 100;
const PAUSE_MS = Math.round(1000 / 6);
const PULSE_COUNT = 6;

/**
 * Fires a short vibration burst (6 x 0.1s pulses, ~1/6s apart) when a dice
 * roll starts. No-op on browsers without the Vibration API (notably iOS Safari).
 */
export function vibrateDiceRoll(): void {
  if (!DICE_VIBRATION_ENABLED) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  const pattern: number[] = [];
  for (let i = 0; i < PULSE_COUNT; i++) {
    if (i > 0) pattern.push(PAUSE_MS);
    pattern.push(PULSE_MS);
  }
  navigator.vibrate(pattern);
}
