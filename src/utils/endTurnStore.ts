import { useSyncExternalStore } from 'react';
import { isHeadlessRun } from './headlessStore';

let ready = false;
// A headless sim runs on its own throwaway GameState while the real app
// stays mounted, but this module's `ready` flag is a singleton -- writing to
// it directly would make the real BotController think the real player's
// turn is ready to end (or not) at the wrong moment. Route headless
// read/writes through this separate flag instead.
let headlessReady = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setEndTurn(): void {
  if (isHeadlessRun()) {
    headlessReady = true;
    return;
  }

  ready = true;
  emit();
}

export function resetEndTurn(): void {
  if (isHeadlessRun()) {
    headlessReady = false;
    return;
  }

  ready = false;
  emit();
}

/** Plain (non-hook) read for the headless driver, which isn't a React component. */
export function isEndTurnReady(): boolean {
  return headlessReady;
}

export function useEndTurnReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ready
  );
}
