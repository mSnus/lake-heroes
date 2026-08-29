import { useSyncExternalStore } from 'react';
import { isHeadlessRun } from './headlessStore';

/** Fog wipe fronting a mid-move event screen: black fades in, the fog symbol
 * dims to nothing while the screen is revealed underneath, then black lifts. */
export type TransitionPhase = 'idle' | 'in' | 'hold' | 'out';

export const FOG_IN_MS = 300;
export const FOG_HOLD_MS = 200;
export const FOG_OUT_MS = 300;

let phase: TransitionPhase = 'idle';
const listeners = new Set<() => void>();
let timers: ReturnType<typeof setTimeout>[] = [];

function set(next: TransitionPhase) {
  phase = next;
  listeners.forEach((l) => l());
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/** Calls `reveal` at the midpoint, while the screen is fully black. Headless
 * runs and a wipe already in flight reveal at once, so this never gates game
 * logic. */
export function playFogTransition(reveal: () => void): void {
  if (isHeadlessRun() || phase !== 'idle') {
    reveal();
    return;
  }

  clearTimers();
  set('in');
  timers.push(
    setTimeout(() => {
      set('hold');
      reveal();
    }, FOG_IN_MS),
    setTimeout(() => set('out'), FOG_IN_MS + FOG_HOLD_MS),
    setTimeout(() => {
      set('idle');
      clearTimers();
    }, FOG_IN_MS + FOG_HOLD_MS + FOG_OUT_MS)
  );
}

export function resetFogTransition(): void {
  clearTimers();
  if (phase !== 'idle') set('idle');
}

export function useTransitionPhase(): TransitionPhase {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => phase
  );
}
