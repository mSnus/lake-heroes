import { useSyncExternalStore } from 'react';
import { vibrateDiceRoll } from './vibrateDiceRoll';

type ModalState = {
  active: boolean;
  handler?: Function;
  key: number;
  rolling: boolean;
};

let state: ModalState = { active: false, key: 0, rolling: false };
const listeners = new Set<() => void>();

// Cheat-screen "force next roll": makes the next movement die (DiceWidget's
// single-die roll) return this value instead of a random 1-6, then reverts
// to normal randomness.
let forcedRoll: number | null = null;

export function setForcedRoll(value: number): void {
  forcedRoll = value;
}

export function consumeForcedRoll(): number | null {
  const v = forcedRoll;
  forcedRoll = null;
  return v;
}

function emit() {
  listeners.forEach((l) => l());
}

export function showDice(handler?: Function) {
  if (state.active) {
    console.log('Dice already shown');
    return;
  }

  state = { active: true, handler, key: state.key + 1, rolling: false };
  emit();
}

export function closeModal() {
  console.log('Closing dice modal');
  state = { active: false, handler: undefined, key: state.key, rolling: false };
  emit();
}

export function startDiceRoll() {
  if (!state.active || state.rolling) return;
  // Called directly from the click/keypress handler, so this is still
  // within the user-gesture window the Vibration API requires on Chrome.
  vibrateDiceRoll();
  state = { ...state, rolling: true };
  emit();
}

export function useModal() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}
