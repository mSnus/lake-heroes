import { Board } from '../game/Board';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { say } from '../utils/say';

export function sellTile(
  board: Board,
  player: Player,
  tileIndex: number
): { gold: number; units: number } {
  const tile = board.tiles[tileIndex] as Tile | undefined;
  if (!tile) return { gold: 0, units: 0 };
  if (tile.owner !== player.name) return { gold: 0, units: 0 };

  // Base refund: purchase price
  const baseGold = tile.priceGold || 0;
  const baseUnits = tile.priceUnits || 0;

  // Refund upgrades that were already purchased
  const upgradePrices = tile.upgradePrices || {};
  let upgradesGold = 0;
  let upgradesUnits = 0;
  const level = tile.level || 1;

  for (let l = 2; l <= level; l++) {
    const p = upgradePrices[String(l)];
    if (p) {
      upgradesGold += p.gold || 0;
      upgradesUnits += p.units || 0;
    }
  }

  const totalGold = baseGold + upgradesGold;
  const totalUnits = baseUnits + upgradesUnits;

  // Mutate tile and player
  tile.owner = undefined;
  tile.level = 1;

  player.gold = (player.gold || 0) + totalGold;
  player.units = (player.units || 0) + totalUnits;

  // Try to remove tile from player's ownedTiles list if present
  if (Array.isArray((player as any).ownedTiles)) {
    (player as any).ownedTiles = (player as any).ownedTiles.filter((t: any) => t !== tile.name);
  }

  say(`${player.name} sold ${tile.name} for ${totalGold} gold and ${totalUnits} units`, 'info');

  return { gold: totalGold, units: totalUnits };
}
