import { useSyncExternalStore } from 'react';

type ModalState = {
  active: boolean;
  handler?: Function;
  key: number;
  rolling: boolean;
};

let state: ModalState = { active: false, key: 0, rolling: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showDice(handler?: Function) {
  if (state.active) {
    console.log('Dice already shown');
    return;
  }

  console.log('Showing dice', handler);
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
