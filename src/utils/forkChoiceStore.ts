import { useSyncExternalStore } from 'react';

export type ForkChoice = 'short' | 'long';

/**
 * Which branch of the map's fork (see game/constants.ts's FORK_* and
 * game/boardPath.ts) the active player will take on their next roll --
 * a transient UI preference, not persisted GameState, so it always starts
 * back at the default ('short') on reload rather than needing its own save/
 * rehydrate plumbing. rollAndMove.ts reads it once, right before a roll's
 * movement is simulated/applied, then resets it back to the default so a
 * stale choice can't leak into a later visit to the fork.
 */
let choice: ForkChoice = 'short';
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function setForkChoice(next: ForkChoice): void {
  choice = next;
  emit();
}

export function getForkChoice(): ForkChoice {
  return choice;
}

export function resetForkChoice(): void {
  choice = 'short';
  emit();
}

export function useForkChoice(): ForkChoice {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => choice
  );
}
