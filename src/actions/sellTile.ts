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

  // Base refund: purchase price
  const baseGold = tile.prices['1']?.gold ?? (0 || 0);
  const baseUnits = tile.prices['1']?.units ?? (0 || 0);

  // Refund upgrades that were already purchased
  const prices = tile.prices || {};
  let upgradesGold = 0;
  let upgradesUnits = 0;
  const level = tile.level || 1;

  for (let l = 2; l <= level; l++) {
    const p = prices[l];
    if (p) {
      upgradesGold += p.gold || 0;
      upgradesUnits += p.units || 0;
    }
  }

  const totalGold = baseGold + upgradesGold;
  const totalUnits = baseUnits + upgradesUnits;

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
