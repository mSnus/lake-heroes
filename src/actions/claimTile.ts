import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';

export function claimTile(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const attacker = board.activePlayer;
  const tile = board.activeTile;

  if (tile.isOwned()) return;
  if (!tile.isAffordable(attacker.gold, attacker.units, attacker.fame)) return;

  showScreen({
    content: React.createElement(BattleScreen, {
      attacker,
      tile,
      gameState: board,
      updateGameState,
    }),
  });
}
