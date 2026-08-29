import { useSyncExternalStore } from 'react';
import React from 'react';
import { setEndTurn } from './endTurnStore';
import { showDice, startDiceRoll } from './diceStore';
import { isHeadlessRun } from './headlessStore';
import { playFogTransition } from './transitionStore';
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
  caravanDefenceRiders?: number;
  caravanPrize?: number;
  // Battle-resume identifiers only — enough to reconstruct who's fighting
  // whom and over what, not the fight's in-progress state. A restored
  // battle always restarts fresh from turn 0.
  tileIndex?: number;
  defenderId?: number;
  battlefieldUnits?: number;
  ambushAttackerUnits?: number;
  ambushAttackerRiders?: number;
  hordeUnits?: number;
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
    /** Gold the payer held immediately BEFORE the toll was charged, so the
     * screen can show the before -> after transition. Omitted when nothing
     * was charged just now (e.g. re-entering an already-settled encounter),
     * in which case only the amount is shown. */
    goldBefore?: number;
    outcomeText?: string;
    subMessage?: string;
    gold?: number;
    militia?: number;
    riders?: number;
  };
  message?: string;
  htmlMessage?: string;
  caravanDefence?: number;
  caravanDefenceRiders?: number;
  caravanPrize?: number;
  buttons?: ScreenButton[];
  sellMode?: boolean;
  sellHeader?: string;
  content?: React.ReactNode;
  doNotPersist?: boolean;
  // Mirrors the same fields on SavedScreen — set alongside `content` for a
  // battle screen so a reload can reconstruct it (see App.tsx's save
  // effect and restore switch).
  tileIndex?: number;
  defenderId?: number;
  battlefieldUnits?: number;
  ambushAttackerUnits?: number;
  ambushAttackerRiders?: number;
  hordeUnits?: number;
}

let state: ScreenConfig | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showScreen(config: ScreenConfig): void {
  if (isHeadlessRun()) {
    // Nothing ever renders during a headless run -- but a single-button
    // screen ("acknowledge and continue", the overwhelming majority of
    // encounter screens) still needs its click to fire or the turn would
    // hang forever waiting for a click that will never come. Anything else
    // (a real decision between 2+ buttons, or a custom `content` component
    // like BattleScreen/TavernModal whose self-driving logic only runs once
    // mounted) is resolved by its own caller checking isHeadlessRun() and
    // never reaching this function at all -- see showBattleScreen and the
    // per-encounter headless branches.
    if (config.buttons?.length === 1) config.buttons[0].onClick();
    return;
  }

  state = config;
  console.log('showing screen', state);
  emit();
  // A screen always opens pinned to its own top -- otherwise it can render
  // below wherever the page happened to be scrolled (e.g. after scrolling
  // down to read the game log) and look like nothing happened.
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Lock the page body so it can't be scrolled behind/around the screen
  // while one is showing -- restored by clearScreen().
  document.body.classList.add('screen-open');
}

/** showScreen fronted by the fog wipe, for an event interrupting a move. */
export function showScreenWithFog(config: ScreenConfig): void {
  playFogTransition(() => showScreen(config));
}

export function markScreenResolved(): void {
  if (isHeadlessRun()) return;
  if (state) {
    state = { ...state, doNotPersist: true };
    localStorage.removeItem('game-screen');
    emit();
  }
}

export function clearScreen(): void {
  if (isHeadlessRun()) return;
  state = null;
  localStorage.removeItem('game-screen');
  emit();
  document.body.classList.remove('screen-open');
}

export function showPrisonScreen(message: string): void {
  showScreen({
    screenType: 'prison',
    background: 'assets/screens/prison.jpg',
    title: t('prison.title'),
    htmlMessage: `${t('prison.flavorText')}<br /><br />${message}`,
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
  showScreenWithFog({
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
  showScreenWithFog({
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
