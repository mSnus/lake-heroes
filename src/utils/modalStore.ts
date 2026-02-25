import { useSyncExternalStore } from 'react';

type ModalType = null | 'new-game' | 'dice';

type ModalState = {
  type: ModalType;
  handler?: Function;
};

let state: ModalState = { type: null };
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
  state = { type, handler };
  emit();
}

export function closeModal() {
  console.log('Closing modal', state.type);
  state = { type: null, handler: undefined };
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
