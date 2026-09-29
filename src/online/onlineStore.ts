import { useSyncExternalStore } from 'react';
import { setSeatSession } from '../game/seats';
import { SeatCode } from './api';

const STORAGE_KEY = 'online-game';
const CLIENT_KEY = 'online-client-id';

export type SyncState =
  | 'idle' // no online game
  | 'ready' // in sync with the server
  | 'pushing' // sending our finished turn
  | 'waiting' // someone else's turn; polling
  | 'error'; // last request failed — see `error`

export interface OnlineSession {
  /** This browser's join code (identifies the seat to the server). */
  code: string;
  /** Index into GameState.players — the server's `playerIndex` for `code`. */
  seat: number;
  /** Every seat this browser plays. Just [seat] normally; several when the
   * game was opened from a bundle link, i.e. hot-seat on one device. */
  seats: number[];
  /** Host only: which seats share a link. links[i] means seat i is bundled
   * with seat i-1. Purely a client-side grouping -- the server still holds one
   * code per seat, a bundle link just carries several of them. */
  links?: boolean[];
  /** The client that created the game drives the bot seats. */
  isHost: boolean;
  /** Last version we successfully read or wrote. */
  version: number;
  status: 'active' | 'finished';
  /** Every seat's join code — known only to the host, who received them when
   * the game was published. A joiner's GET only ever reveals its own seat, so
   * this stays undefined for them. Persisted because the host needs to hand
   * the links out over the life of the game, not just at creation. */
  codes?: SeatCode[];
}

interface OnlineState extends Partial<OnlineSession> {
  sync: SyncState;
  error?: string;
}

/**
 * Identifies this *browser*, not this seat — so we can tell our own writes from
 * those of someone who opened the same join code elsewhere (a shared link, or
 * the same person on a second device). The server has no sessions, so this is
 * the only way to notice that case. Stable across reloads.
 */
function loadClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c${Date.now()}${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_KEY, fresh);
    return fresh;
  } catch {
    // Storage unavailable (private mode). A per-load id still distinguishes
    // this tab from other clients for the lifetime of the page.
    return `c${Date.now()}${Math.random().toString(36).slice(2)}`;
  }
}

export const clientId = loadClientId();

function loadSession(): OnlineState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sync: 'idle' };
    const s = JSON.parse(raw) as OnlineSession;
    if (typeof s?.code !== 'string' || typeof s?.seat !== 'number') return { sync: 'idle' };
    // Saves from before bundles existed have no `seats`.
    return { ...s, seats: Array.isArray(s.seats) && s.seats.length ? s.seats : [s.seat], sync: 'ready' };
  } catch {
    return { sync: 'idle' };
  }
}

let current: OnlineState = loadSession();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Mirror the seat into game/seats, which game logic reads synchronously and
 * which must never import React. Keeping this in one place means the two can't
 * disagree about which seat we are. */
function syncSeats(): void {
  setSeatSession(
    current.code !== undefined && current.seats?.length
      ? { seats: current.seats, isHost: !!current.isHost }
      : null
  );
}

syncSeats();

function persist(): void {
  try {
    if (current.code === undefined) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const { code, seat, seats, links, isHost, version, status, codes } = current;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code, seat, seats, links, isHost, version, status, codes })
    );
  } catch {
    // Storage unavailable — the session still lives in memory for this load.
  }
}

export function getOnline(): OnlineState {
  return current;
}

export function isOnlineGame(): boolean {
  return current.code !== undefined;
}

/** Join or host: establishes the seat this browser plays. */
export function startOnlineSession(session: OnlineSession): void {
  current = { ...session, sync: 'ready' };
  syncSeats();
  persist();
  emit();
}

export function updateOnline(patch: Partial<OnlineState>): void {
  current = { ...current, ...patch };
  syncSeats();
  persist();
  emit();
}

/** Leave the online game entirely (New Game, or game over). Must run wherever
 * the local game is torn down, or the next game inherits this code. */
export function clearOnlineSession(): void {
  current = { sync: 'idle' };
  syncSeats();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }

  emit();
}

export function useOnline(): OnlineState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current
  );
}
