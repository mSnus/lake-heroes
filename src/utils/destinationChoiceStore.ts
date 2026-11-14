import { useSyncExternalStore } from 'react';

export interface DestinationChoice {
  options: number[];
}

let state: DestinationChoice | null = null;
let resolveChoice: ((slot: number) => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Shows the reachable slots on the board and resolves with the one the player taps. */
export function requestDestination(options: number[]): Promise<number> {
  return new Promise((resolve) => {
    state = { options };
    resolveChoice = resolve;
    emit();
  });
}

/** Tapping a highlighted slot moves there straight away. */
export function tapDestination(slot: number): void {
  if (!state || !state.options.includes(slot)) return;
  const resolve = resolveChoice;
  clearDestinationChoice();
  resolve?.(slot);
}

/** Drops a pending choice without resolving it (new game, received online state). */
export function clearDestinationChoice(): void {
  state = null;
  resolveChoice = null;
  emit();
}

export function useDestinationChoice(): DestinationChoice | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}
