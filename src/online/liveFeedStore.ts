import { useSyncExternalStore } from 'react';

/**
 * What another player's turn is saying right now: the banner they last set,
 * and how far through their narration we have read.
 *
 * Deliberately separate from onlineStore, which writes to localStorage on
 * every change — this updates a few times per turn and none of it is worth
 * persisting. A reloaded client starts from "now" on purpose: the toasts it
 * missed are gone either way, and replaying a backlog at once is worse than
 * losing it.
 */

interface LiveFeed {
  /** Mirror of the acting player's GameMessage, or null to fall back to the
   * banner carried in the synced board. */
  banner: string | null;
  /** Cursor of the event that set `banner`, so it can be retired once the
   * state that includes it has been applied. */
  bannerSeq: number;
  /** Highest event seq consumed. */
  cursor: number;
}

let current: LiveFeed = { banner: null, bannerSeq: 0, cursor: 0 };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getLiveFeed(): LiveFeed {
  return current;
}

export function setCursor(cursor: number): void {
  if (cursor === current.cursor) return;
  current = { ...current, cursor };
  emit();
}

export function setLiveBanner(banner: string, seq: number): void {
  current = { ...current, banner, bannerSeq: seq };
  emit();
}

/**
 * Retire the live banner once the applied state already contains it.
 *
 * Not cleared on every pull: an event can arrive a beat before the state that
 * carries it, and blanking unconditionally would make the banner flicker off
 * and straight back on.
 */
export function retireLiveBanner(eventsThrough: number): void {
  if (current.banner === null || current.bannerSeq > eventsThrough) return;
  current = { ...current, banner: null, bannerSeq: 0 };
  emit();
}

/** Leaving the game, or starting a new one. */
export function resetLiveFeed(): void {
  current = { banner: null, bannerSeq: 0, cursor: 0 };
  emit();
}

export function useLiveFeed(): LiveFeed {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current
  );
}
