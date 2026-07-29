import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';
import { Player } from '../game/Player';

export function fightTile(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const attacker = board.activePlayer;
  const tile = board.activeTile;
  const defence = tile.defence;

  if (attacker.armyPower < defence) return;

  const defender = board.players.find((p: Player) => p.id === tile.owner);
  if (!defender) return;

  showScreen({
    content: React.createElement(BattleScreen, {
      attacker,
      defender,
      tile,
      gameState: board,
      updateGameState,
    }),
  });
}
