import { useSyncExternalStore } from 'react';
import React from 'react';
import { setEndTurn } from './endTurnStore';
import { showDice, startDiceRoll } from './diceStore';
import { Tile } from '../game/Tile';
import { t } from '../i18n';

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
    tile?: Tile;
    ownerName?: string;
    ownerColor?: string;
    canFight?: boolean;
    fee?: number;
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
        label: t('common.continue'),
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
    buttons: [{ label: t('screenStore.rollDice'), action: 'roll-dice', onClick: startDiceRoll }],
  });
}

export function showTavernScreen(title: string, handler: (roll: number) => void): void {
  showDice(handler);
  showScreen({
    screenType: 'tavern',
    background: 'assets/screens/tavern.jpg',
    title,
    message: t('screenStore.tavernMessage'),
    fade: true,
    buttons: [{ label: t('screenStore.rollDice'), action: 'roll-dice', onClick: startDiceRoll }],
  });
}

export function showSphynxScreen(handler: (roll: number) => void): void {
  showDice(handler);
  showScreen({
    screenType: 'sphynx',
    background: 'assets/screens/sphynx.jpg',
    title: t('screenStore.sphynxTitle'),
    message: t('screenStore.sphynxMessage'),
    fade: true,
    buttons: [{ label: t('screenStore.rollDice'), action: 'roll-dice', onClick: startDiceRoll }],
  });
}

export function showJokerScreen(message: string, title?: string): void {
  showScreen({
    screenType: 'joker',
    background: 'assets/screens/joker.jpg',
    title,
    htmlMessage: message,
    buttons: [{ label: t('screenStore.acceptYourDestiny'), action: 'end-turn', onClick: clearScreen }],
  });
}

export function showDragonSkyScreen(
  onContinue: () => void,
  playerName?: string,
  playerColor?: string
): void {
  const who = playerName
    ? `<span style="color:${playerColor ?? 'inherit'}">${playerName}</span>`
    : t('screenStore.you');
  showScreen({
    screenType: 'dragon-sky',
    background: 'assets/screens/dragon-sky.jpg',
    htmlMessage: t('screenStore.dragonInSky', { who }),
    buttons: [
      {
        label: t('screenStore.scatterAndHide'),
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
        label: t('common.continue'),
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
    ],
  });
}

// `message` may contain HTML (e.g. a colored player-name span).
export function showDragonChallengeScreen(
  message: string,
  onFight: () => void,
  onDecline: () => void,
  declineLabel = t('screenStore.rollDiceInstead')
): void {
  showScreen({
    screenType: 'dragon',
    background: 'assets/screens/dragon.jpg',
    htmlMessage: message,
    buttons: [
      {
        label: t('screenStore.challengeTheDragon'),
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

export function showKnightPromotionScreen(
  playerName: string,
  playerColor: string,
  onContinue: () => void
): void {
  showScreen({
    screenType: 'promotion',
    background: 'assets/screens/promotion.jpg',
    fade: true,
    title: t('screenStore.promotionTitle'),
    htmlMessage: t('screenStore.promotionMessage', {
      playerSpan: `<span style="color:${playerColor}">${playerName}</span>`,
    }),
    buttons: [
      {
        label: t('screenStore.keepCalmAndCarryOn'),
        onClick: () => {
          clearScreen();
          onContinue();
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
