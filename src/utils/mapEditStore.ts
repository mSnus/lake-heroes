import { useSyncExternalStore } from 'react';
import { slots } from '../components/board/common';

type EditTarget = { kind: 'tile'; index: number } | { kind: 'player-icon' } | null;

interface MapEditState {
  active: boolean;
  target: EditTarget;
}

// Live values BoardCanvas.tsx's renderPlayer() reads directly -- mutated in
// place here, then a store emit() forces a re-render that picks up the new
// values (same live-mutation pattern as `slots` below for tile positions).
export const playerIconOffset = {
  anchorXPct: 11.5,
  anchorYPct: 12.5,
  clusterStepPct: 4,
};

// Same as playerIconOffset, but for a tile whose textPos is 'left' or
// 'right' (see components/board/common.ts's MapSlotPct) -- those tiles lay
// their title text out to the side instead of below, so the player marker's
// anchor needs its own offset to still land in the right spot.
export const playerIconOffsetH = {
  anchorXPct: 9,
  anchorYPct: 10.5,
  clusterStepPct: 4,
};

let state: MapEditState = { active: false, target: null };
const listeners = new Set<() => void>();

function emit() {
  // Reassign to a new object reference every call, even when only `slots`/
  // `playerIconOffset` fields mutated (not `state` itself) -- useSyncExternalStore
  // bails out of re-rendering subscribers when getSnapshot() returns a
  // reference `Object.is`-equal to the last one, so without this, arrow-key
  // nudges would update the console log but never repaint the board.
  state = { ...state };
  listeners.forEach((l) => l());
}

function logFullMap() {
  console.log('📋 Full map (copy into map.json):');
  console.log(JSON.stringify(slots, null, 2));
}

function logPlayerIconOffset() {
  console.log(
    `🧑 Player icon offset: anchorX=${playerIconOffset.anchorXPct}%, anchorY=${playerIconOffset.anchorYPct}%, clusterStep=${playerIconOffset.clusterStepPct}%`
  );
  console.log(
    "Copy into mapEditStore.ts's `playerIconOffset` defaults (anchorXPct / anchorYPct / clusterStepPct) to make it stick."
  );
}

// Holding an arrow key fires keydown far faster than a render is useful for,
// and a pointermove drag is just as chatty. Every event still mutates the
// value immediately (so the final position is always exactly right once you
// stop), but the visual re-render is coalesced to once per animation frame.
// Console output is intentionally NOT emitted here -- only on Enter/disable,
// so the console isn't spammed on every nudge/drag step.
let rafScheduled = false;
function scheduleAnnounce() {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    if (!state.target) return;
    emit();
  });
}

// Mouse-drag counterpart to the arrow-key nudging below -- BoardCanvas calls
// this with the tile's new absolute position (computed from the pointer's
// movement against the board's own rendered size, so it already accounts
// for the board's zoom transform). Selects the tile as a side effect, same
// as clicking it, so a drag alone is enough to start moving one.
export function mapEditDragTile(index: number, xPct: number, yPct: number) {
  if (!state.active) return;
  const slot = slots[index];
  if (!slot) return;
  if (state.target?.kind !== 'tile' || state.target.index !== index) {
    state = { ...state, target: { kind: 'tile', index } };
  }

  slot.xPct = xPct;
  slot.yPct = yPct;
  scheduleAnnounce();
}

function handleKeyDown(e: KeyboardEvent) {
  if (!state.target) return;

  if (e.key === 'Enter') {
    if (state.target.kind === 'tile') logFullMap();
    else logPlayerIconOffset();
    state = { ...state, target: null };
    emit();
    return;
  }

  let moved = false;

  if (state.target.kind === 'tile') {
    const slot = slots[state.target.index];
    if (!slot) return;

    if (e.key === 'ArrowLeft') {
      slot.xPct -= 1;
      moved = true;
    }

    if (e.key === 'ArrowRight') {
      slot.xPct += 1;
      moved = true;
    }

    if (e.key === 'ArrowUp') {
      slot.yPct -= 1;
      moved = true;
    }

    if (e.key === 'ArrowDown') {
      slot.yPct += 1;
      moved = true;
    }

    if (moved) {
      e.preventDefault();
      scheduleAnnounce();
    }

    return;
  }

  // Player-icon target: arrows nudge the anchor offset, +/- adjust cluster spacing.
  if (e.key === 'ArrowLeft') {
    playerIconOffset.anchorXPct -= 0.5;
    moved = true;
  }

  if (e.key === 'ArrowRight') {
    playerIconOffset.anchorXPct += 0.5;
    moved = true;
  }

  if (e.key === 'ArrowUp') {
    playerIconOffset.anchorYPct -= 0.5;
    moved = true;
  }

  if (e.key === 'ArrowDown') {
    playerIconOffset.anchorYPct += 0.5;
    moved = true;
  }

  if (e.key === '=' || e.key === '+') {
    playerIconOffset.clusterStepPct += 0.5;
    moved = true;
  }

  if (e.key === '-' || e.key === '_') {
    playerIconOffset.clusterStepPct -= 0.5;
    moved = true;
  }

  if (moved) {
    e.preventDefault();
    scheduleAnnounce();
  }
}

export function enableMapEditMode() {
  state = { active: true, target: null };
  window.addEventListener('keydown', handleKeyDown);
  emit();
  console.log(
    '🗺️ Map edit mode ON — click and drag a tile to move it (or arrow keys once selected), Enter to print+deselect, or click a player icon to adjust the shared offset (arrow keys for X/Y, +/- for cluster spacing, Enter to print+deselect). Nothing is printed to the console until Enter is pressed.'
  );
}

export function disableMapEditMode() {
  state = { active: false, target: null };
  window.removeEventListener('keydown', handleKeyDown);
  emit();
  console.log('🗺️ Map edit mode OFF.');
}

export function mapEditSelectTile(index: number) {
  if (!state.active) return;
  state = { ...state, target: { kind: 'tile', index } };
  emit();
}

export function mapEditSelectPlayerIcon() {
  if (!state.active) return;
  state = { ...state, target: { kind: 'player-icon' } };
  emit();
}

export function isMapEditActive(): boolean {
  return state.active;
}

export function useMapEditStore(): MapEditState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}

// Expose to browser console
(window as any).enableMapEditMode = enableMapEditMode;
(window as any).disableMapEditMode = disableMapEditMode;
