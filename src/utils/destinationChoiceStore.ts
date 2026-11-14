import { useSyncExternalStore } from 'react';

export interface DestinationChoice {
  options: number[];
  selected: number | null;
}

let state: DestinationChoice | null = null;
let resolveChoice: ((slot: number) => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Shows the reachable slots on the board and resolves with the one the player confirms. */
export function requestDestination(options: number[]): Promise<number> {
  return new Promise((resolve) => {
    state = { options, selected: null };
    resolveChoice = resolve;
    emit();
  });
}

/** First tap selects a slot, tapping the selected slot again confirms it. */
export function tapDestination(slot: number): void {
  if (!state || !state.options.includes(slot)) return;
  if (state.selected !== slot) {
    state = { ...state, selected: slot };
    emit();
    return;
  }

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
