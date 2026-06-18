import React from 'react';
import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { changeFame } from '../utils/fame';
import { showScreen } from '../utils/screenStore';
import { TileClaimScreen } from '../components/TileClaimScreen';

export async function buyTile(
  gameState: GameState | null,
  updateGameState: (state: GameState) => void
) {
  if (!gameState) return;

  const player = gameState.activePlayer;
  const tile = gameState.activeTile;

  console.log('Action: buy tile', player, tile);

  if (
    player.gold >= (tile.prices['1']?.gold ?? 0) &&
    player.units >= (tile.prices['1']?.units ?? 0) &&
    !tile.isOwned()
  ) {
    player.gold -= tile.prices['1']?.gold ?? 0;
    player.units -= tile.prices['1']?.units ?? 0;
    tile.owner = player.id;
    player.ownedTiles.push(player.position);
    changeFame(player, 1);
    updateGameState(gameState);
    gameEvent('displayTile', {});
    showScreen({ content: React.createElement(TileClaimScreen, { tile, player }) });
  }
}
