import { useSyncExternalStore } from 'react';

let ready = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setEndTurn(): void {
  ready = true;
  emit();
}

export function resetEndTurn(): void {
  ready = false;
  emit();
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
