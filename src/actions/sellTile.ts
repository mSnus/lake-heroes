import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';

export function sellTile(
  gameState: GameState,
  player: Player,
  tile: Tile
): { gold: number; units: number } {
  if (!tile) return { gold: 0, units: 0 };
  if (tile.owner !== player.id) return { gold: 0, units: 0 };

  // Refund = the tile's currentPrice (base level's units mirrors its
  // defence, same as isAffordable(); upgrade levels refund their price).
  const { gold: totalGold, units: totalUnits } = tile.currentPrice;

  // Mutate tile and player
  tile.owner = null;
  tile._level = 1;

  player.gold = (player.gold || 0) + totalGold;
  player.units = (player.units || 0) + totalUnits;

  // Remove tile position index from player's ownedTiles list
  const tileIndex = gameState.tiles.indexOf(tile);
  if (tileIndex !== -1) {
    player.ownedTiles = player.ownedTiles.filter((idx) => idx !== tileIndex);
    changeFame(player, -1);
  }

  say(`${player.name} sold ${tile.name} for ${totalGold} gold and ${totalUnits} units`, 'info');

  return { gold: totalGold, units: totalUnits };
}
