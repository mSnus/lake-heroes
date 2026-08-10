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
  anchorXPct: 4,
  anchorYPct: 0,
  clusterStepPct: 12,
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

function logPosition(index: number) {
  const slot = slots[index];
  console.log(`Tile ${index}: xPct=${slot.xPct.toFixed(4)}, yPct=${slot.yPct.toFixed(4)}`);
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
    'Copy into BoardCanvas.tsx: PLAYER_ANCHOR_OFFSET_X_PCT / PLAYER_ANCHOR_OFFSET_Y_PCT / PLAYER_CLUSTER_STEP_PCT'
  );
}

// Holding an arrow key fires keydown far faster than a render/log is useful
// for. Every keydown still mutates the value immediately (so the final
// position is always exactly right once you stop pressing), but the visual
// re-render + console log are coalesced to once per animation frame.
let rafScheduled = false;
function scheduleAnnounce() {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    if (!state.target) return;
    if (state.target.kind === 'tile') logPosition(state.target.index);
    else logPlayerIconOffset();
    emit();
  });
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
    '🗺️ Map edit mode ON — click a tile to select it (arrow keys to move, Enter to print+deselect), or click a player icon to adjust the shared offset (arrow keys for X/Y, +/- for cluster spacing, Enter to print+deselect).'
  );
}

export function disableMapEditMode() {
  state = { active: false, target: null };
  window.removeEventListener('keydown', handleKeyDown);
  emit();
  logFullMap();
  logPlayerIconOffset();
  console.log('🗺️ Map edit mode OFF.');
}

export function mapEditSelectTile(index: number) {
  if (!state.active) return;
  state = { ...state, target: { kind: 'tile', index } };
  emit();
  logPosition(index);
}

export function mapEditSelectPlayerIcon() {
  if (!state.active) return;
  state = { ...state, target: { kind: 'player-icon' } };
  emit();
  logPlayerIconOffset();
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
