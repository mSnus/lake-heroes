import { useSyncExternalStore } from 'react';
import React from 'react';
import { setEndTurn } from './endTurnStore';
import { showDice, startDiceRoll } from './diceStore';

export interface ScreenButton {
  label: string;
  action?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface SavedScreen {
  type: string;
  message?: string;
  htmlMessage?: string;
  title?: string;
  caravanDefence?: number;
  caravanPrize?: number;
}

export interface ScreenConfig {
  background?: string;
  fade?: boolean;
  title?: string;
  spriteImage?: string;
  screenType?: string;
  encounter?: {
    playerName: string;
    playerColor: string;
    tileName: string;
    tileDefence?: number;
    ownerName?: string;
    ownerColor?: string;
    outcomeText?: string;
    subMessage?: string;
    gold?: number;
    units?: number;
  };
  message?: string;
  htmlMessage?: string;
  caravanDefence?: number;
  caravanPrize?: number;
  buttons?: ScreenButton[];
  sellMode?: boolean;
  sellHeader?: string;
  content?: React.ReactNode;
  doNotPersist?: boolean;
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

export function markScreenResolved(): void {
  if (state) {
    state = { ...state, doNotPersist: true };
    localStorage.removeItem('game-screen');
    emit();
  }
}

export function clearScreen(): void {
  state = null;
  localStorage.removeItem('game-screen');
  emit();
}

export function showPrisonScreen(message: string, title?: string): void {
  showScreen({
    screenType: 'prison',
    background: 'assets/screens/prison.jpg',
    title: '',
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

export function showTreasureScreen(title: string, handler: (roll: number) => void): void {
  showDice(handler);
  showScreen({
    screenType: 'treasure',
    background: 'assets/screens/treasure.jpg',
    title,
    buttons: [{ label: 'Roll Dice 🎲', action: 'roll-dice', onClick: startDiceRoll }],
  });
}

export function showTavernScreen(title: string, handler: (roll: number) => void): void {
  showDice(handler);
  showScreen({
    screenType: 'tavern',
    background: 'assets/screens/tavern.jpg',
    title,
    message: 'By them a round and toss a coin!',
    fade: true,
    buttons: [{ label: 'Roll Dice 🎲', action: 'roll-dice', onClick: startDiceRoll }],
  });
}

export function showSphynxScreen(handler: (roll: number) => void): void {
  showDice(handler);
  showScreen({
    screenType: 'sphynx',
    background: 'assets/screens/sphynx.jpg',
    title: 'Sphynx stares at you',
    fade: true,
    buttons: [{ label: 'Roll Dice 🎲', action: 'roll-dice', onClick: startDiceRoll }],
  });
}

export function showJokerScreen(message: string, title?: string): void {
  showScreen({
    screenType: 'joker',
    background: 'assets/screens/joker.jpg',
    title,
    message,
    buttons: [{ label: 'Accept your destiny', action: 'end-turn', onClick: clearScreen }],
  });
}

export function showDragonSkyScreen(
  onContinue: () => void,
  playerName?: string,
  playerColor?: string
): void {
  const who = playerName
    ? `<span style="color:${playerColor ?? 'inherit'}">${playerName}</span>`
    : 'You';
  showScreen({
    screenType: 'dragon-sky',
    background: 'assets/screens/dragon-sky.jpg',
    htmlMessage: `${who} sees a giant black dragon passing on the sky`,
    buttons: [
      {
        label: 'Continue',
        action: 'continue',
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
    ],
  });
}

export function showDragonAttackScreen(message: string, onContinue: () => void): void {
  showScreen({
    screenType: 'dragon-attack',
    background: 'assets/screens/dragon-attack.jpg',
    message,
    buttons: [
      {
        label: 'Continue',
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
    ],
  });
}

export function showDragonChallengeScreen(
  message: string,
  onFight: () => void,
  onDecline: () => void,
  declineLabel = 'Roll Dice Instead 🎲'
): void {
  showScreen({
    screenType: 'dragon',
    background: 'assets/screens/dragon.jpg',
    message,
    buttons: [
      {
        label: 'Challenge the Dragon 🐉',
        action: 'fight',
        onClick: () => {
          clearScreen();
          onFight();
        },
      },
      {
        label: declineLabel,
        action: 'continue',
        onClick: () => {
          clearScreen();
          onDecline();
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
