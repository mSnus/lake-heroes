import { useSyncExternalStore } from 'react';
import React from 'react';
import { setEndTurn } from './endTurnStore';

export interface ScreenButton {
  label: string;
  action?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ScreenConfig {
  background?: string;
  fade?: boolean;
  title?: string;
  sprite?: { x: number; y: number };
  encounter?: {
    playerName: string;
    playerColor: string;
    tileName: string;
    ownerName?: string;
    ownerColor?: string;
    outcomeText?: string;
    subMessage?: string;
  };
  message?: string;
  htmlMessage?: string;
  buttons?: ScreenButton[];
  sellMode?: boolean;
  sellHeader?: string;
  content?: React.ReactNode;
}

let state: ScreenConfig | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showScreen(config: ScreenConfig): void {
  state = config;
  console.log('showing screen', state);
  emit();
}

export function clearScreen(): void {
  state = null;
  emit();
}

export function showPrisonScreen(message: string, title?: string): void {
  showScreen({
    background: 'assets/screens/prison.jpg',
    title,
    message,
    buttons: [
      {
        label: 'Continue',
        action: 'end-turn',
        onClick: () => {
          clearScreen();
          setEndTurn();
        },
      },
    ],
  });
}

export function useScreen(): ScreenConfig | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}
