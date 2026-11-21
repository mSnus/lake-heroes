import { useSyncExternalStore } from 'react';

/** Counts the messages that would have toasted; the log drawer slides down for each. */
let pulses = 0;
const listeners = new Set<() => void>();

export function notifyLogDrawer(): void {
  pulses++;
  listeners.forEach((l) => l());
}

export function useLogDrawerPulses(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pulses
  );
}
