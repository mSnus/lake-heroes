import { useSyncExternalStore } from 'react';
import { slots } from '../components/board/common';

interface MapEditState {
  active: boolean;
  selectedIndex: number | null;
}

let state: MapEditState = { active: false, selectedIndex: null };
const listeners = new Set<() => void>();

function emit() {
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

function handleKeyDown(e: KeyboardEvent) {
  if (state.selectedIndex === null) return;
  const slot = slots[state.selectedIndex];
  if (!slot) return;

  if (e.key === 'Enter') {
    logFullMap();
    state = { ...state, selectedIndex: null };
    emit();
    return;
  }

  let moved = false;
  if (e.key === 'ArrowLeft')  { slot.xPct -= 1; moved = true; }
  if (e.key === 'ArrowRight') { slot.xPct += 1; moved = true; }
  if (e.key === 'ArrowUp')    { slot.yPct -= 1; moved = true; }
  if (e.key === 'ArrowDown')  { slot.yPct += 1; moved = true; }

  if (moved) {
    e.preventDefault();
    logPosition(state.selectedIndex);
    emit();
  }
}

function enable() {
  state = { active: true, selectedIndex: null };
  window.addEventListener('keydown', handleKeyDown);
  emit();
  console.log('🗺️ Map edit mode ON — click a tile to select, arrow keys to move, Enter to deselect & print full map.');
}

function disable() {
  state = { active: false, selectedIndex: null };
  window.removeEventListener('keydown', handleKeyDown);
  emit();
  logFullMap();
  console.log('🗺️ Map edit mode OFF.');
}

export function mapEditSelectTile(index: number) {
  if (!state.active) return;
  state = { ...state, selectedIndex: index };
  emit();
  logPosition(index);
}

export function isMapEditActive(): boolean {
  return state.active;
}

export function useMapEditStore(): MapEditState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

// Expose to browser console
(window as any).enableMapEditMode = enable;
(window as any).disableMapEditMode = disable;
