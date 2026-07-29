import React from 'react';
import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showScreen, showDragonChallengeScreen, clearScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';

export const DRAGON_UNITS_THRESHOLD = 50;

export function fightDragon(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const player = board.activePlayer;

  showScreen({
    screenType: 'dragon-battle',
    content: React.createElement(BattleScreen, {
      mode: 'dragon',
      attacker: player,
      gameState: board,
      updateGameState,
    }),
  });
}

export function offerDragonChallenge(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onDecline: () => void,
  declineLabel?: string
) {
  const p = board.activePlayer;
  showDragonChallengeScreen(
    `A terrifying dragon guards a pile of gold and jewels. Will <span style="color:${p.color}">${p.name}</span> dare to challenge it?`,
    () => fightDragon(board, updateGameState),
    onDecline,
    declineLabel
  );
}

// Triggered by clicking the dragon icon in the center of the board, once the
// player has already been offered (and possibly declined) the auto-prompt.
export function challengeDragonFromBoard(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  const player = board.activePlayer;
  if (player.armyPower < DRAGON_UNITS_THRESHOLD) {
    say(
      `${player.name} needs at least ${DRAGON_UNITS_THRESHOLD}🧍 to challenge the Dragon`,
      'warning'
    );
    return;
  }
  offerDragonChallenge(board, updateGameState, () => clearScreen(), 'Not Now');
}
