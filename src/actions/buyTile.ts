import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';

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
    tile.owner = player.name;
    player.ownedTiles.push(player.position);
    player.fame++;
    updateGameState(gameState);
    gameEvent('displayTile', {});
  }
}
