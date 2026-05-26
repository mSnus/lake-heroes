import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';

export const DRAGON_UNITS_THRESHOLD = 50;

export function fightDragon(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
) {
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
