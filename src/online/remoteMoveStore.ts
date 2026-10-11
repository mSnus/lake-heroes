import { useSyncExternalStore } from 'react';

/**
 * Where a remote player's token should render RIGHT NOW, while their move is
 * being replayed hop-by-hop from a batch of 'move' events (see
 * useOnlineSync's renderEvents and stream.ts's narrateMove listener) --
 * overrides that one seat's `player.position` in BoardCanvas until the
 * authoritative pulled state catches up and retires it, the same pattern
 * liveFeedStore already uses for the banner.
 *
 * Only ever one seat animates at a time (the active player), but this stays
 * keyed by seat rather than assuming that, since a stale replay finishing
 * after a newer one started would otherwise stomp the wrong player.
 */
export interface RemoteMove {
  seat: number;
  position: number;
  /** Event seq that set this position, so it can be retired once the state
   * that includes it has been applied. */
  seq: number;
}

let current: RemoteMove | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getRemoteMove(): RemoteMove | null {
  return current;
}

export function setRemoteMove(seat: number, position: number, seq: number): void {
  current = { seat, position, seq };
  emit();
}

/** Retire the remote move override once the applied state already contains
 * it -- not cleared on every pull, same reasoning as retireLiveBanner. */
export function retireRemoteMove(eventsThrough: number): void {
  if (current === null || current.seq > eventsThrough) return;
  current = null;
  emit();
}

/** Leaving the game, or starting a new one. */
export function resetRemoteMove(): void {
  current = null;
  emit();
}

export function useRemoteMove(): RemoteMove | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current
  );
}

/** Matches the per-tile delay rollAndMove's own step loop uses locally, so a
 * replayed hop reads at the same pace the acting player actually saw. */
const REPLAY_STEP_MS = 300;

/** A batch of move events can arrive well after they were sent (the observer
 * poll runs every few seconds, not live) -- replay them at the same per-tile
 * pace instead of snapping straight to the last one, so the token is seen to
 * hop along the path rather than teleport.
 *
 * A generation counter guards against two overlapping replays (a fresh batch
 * arriving mid-replay of an older one): starting a new one bumps it, and an
 * in-flight older loop notices and stops rather than fighting over the
 * store. */
let generation = 0;

export async function replayRemoteMoves(steps: RemoteMove[]): Promise<void> {
  const myGeneration = ++generation;
  for (const step of steps) {
    if (myGeneration !== generation) return;
    setRemoteMove(step.seat, step.position, step.seq);
    await new Promise((res) => setTimeout(res, REPLAY_STEP_MS));
  }
}
