import { useSyncExternalStore } from 'react';

type ModalType = null | 'new-game' | 'dice';

type ModalState = {
  type: ModalType;
  handler?: Function;
  key: number;
  rolling: boolean;
};

let state: ModalState = { type: null, key: 0, rolling: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showModal(type: ModalType, handler?: Function) {
  if (state.type === type) {
    console.log('Modal already shown:', type);
    return;
  }

  console.log('Showing modal:', type, handler);
  state = { type, handler, key: state.key + 1, rolling: false };
  emit();
}

export function closeModal() {
  console.log('Closing modal', state.type);
  state = { type: null, handler: undefined, key: state.key, rolling: false };
  emit();
}

export function startDiceRoll() {
  if (state.type !== 'dice' || state.rolling) return;
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
