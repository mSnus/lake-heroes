/**
 * Up to SLOT_COUNT games -- local or online -- can be "in progress" at once,
 * each autosaving under its own storage keys exactly like the single game
 * the app used to support. Switching slots is a full reload: every piece of
 * app state built around there being exactly one live game (the dice modal,
 * the screen stack, the online sync poll loop...) boots fresh against
 * whichever slot is now active, rather than trying to splice live state
 * across the switch.
 *
 * Slot 1 reuses the app's original, unprefixed keys ('game-state',
 * 'online-game', ...) so every pre-existing single-slot save keeps working
 * with no migration; slots 2-5 use the same keys under a per-slot prefix
 * (see keyForSlot). saveToStorage/loadFromStorage (utils/storage.ts) and
 * online/onlineStore.ts's own persistence both read the active slot through
 * this module, so neither has to know slots exist beyond that one call.
 */

export const SLOT_COUNT = 5;

const ACTIVE_SLOT_KEY = 'active-save-slot';

/** The storage keys one slot's game occupies -- kept in one place so the
 * save-slots screen can list/clear exactly what a game actually wrote. */
export const SLOT_STORAGE_BASES = ['game-state', 'game-log', 'game-screen', 'online-game'] as const;

function loadActiveSlot(): number {
  try {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return n >= 1 && n <= SLOT_COUNT ? n : 1;
  } catch {
    return 1;
  }
}

// Read once per page load -- switching slots always reloads the page (see
// switchToSlot), so there is never a live transition to react to mid-session.
const activeSlot = loadActiveSlot();

export function getActiveSlot(): number {
  return activeSlot;
}

/** The storage key `base` resolves to under `slot`. */
export function keyForSlot(slot: number, base: string): string {
  return slot === 1 ? base : `slot${slot}:${base}`;
}

/** The storage key `base` resolves to under the currently active slot. */
export function slotKey(base: string): string {
  return keyForSlot(activeSlot, base);
}

/** Switch the active slot and reload. A no-op if it's already active. */
export function switchToSlot(slot: number): void {
  if (slot < 1 || slot > SLOT_COUNT || slot === activeSlot) return;
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  } catch {
    // Storage unavailable -- nothing to switch to, so stay put.
    return;
  }

  window.location.reload();
}

export interface SlotSummary {
  slot: number;
  active: boolean;
  kind: 'empty' | 'local' | 'online';
  // kind === 'local'
  playerNames?: string[];
  turn?: number;
  gameOver?: boolean;
  // kind === 'online'
  code?: string;
  status?: 'active' | 'finished';
}

/** A lightweight look at what a slot holds, without rehydrating it into a
 * real GameState -- raw JSON.parse of whatever's there is enough to list it. */
export function peekSlot(slot: number): SlotSummary {
  const active = slot === activeSlot;

  try {
    const onlineRaw = localStorage.getItem(keyForSlot(slot, 'online-game'));
    if (onlineRaw) {
      const online = JSON.parse(onlineRaw) as { code?: string; status?: 'active' | 'finished' };
      if (online?.code) {
        return { slot, active, kind: 'online', code: online.code, status: online.status ?? 'active' };
      }
    }
  } catch {
    // Corrupt entry -- fall through and try the local-game key instead.
  }

  try {
    const stateRaw = localStorage.getItem(keyForSlot(slot, 'game-state'));
    if (stateRaw) {
      const state = JSON.parse(stateRaw) as { players?: { name?: string }[]; turns?: number; gameOver?: boolean };
      if (Array.isArray(state.players)) {
        return {
          slot,
          active,
          kind: 'local',
          playerNames: state.players.map((p) => p?.name).filter((n): n is string => !!n),
          turn: typeof state.turns === 'number' ? state.turns : undefined,
          gameOver: !!state.gameOver,
        };
      }
    }
  } catch {
    // Corrupt entry -- reads as empty below, same as truly having nothing.
  }

  return { slot, active, kind: 'empty' };
}

export function listSlots(): SlotSummary[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => peekSlot(i + 1));
}

/** Wipe everything a slot's game wrote -- just the storage, no app-level
 * side effects (online session teardown, override reset, a reload...). The
 * caller handles those when the slot being cleared is the active one. */
export function clearSlotStorage(slot: number): void {
  for (const base of SLOT_STORAGE_BASES) {
    try {
      localStorage.removeItem(keyForSlot(slot, base));
    } catch {
      // ignore
    }
  }
}
