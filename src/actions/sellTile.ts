import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { t } from '../i18n';

/**
 * What selling `tile` right now would refund -- the single source of truth
 * shared by the actual sale (below), TileCard's own preview/confirm text,
 * and TollScreen's sell button. A yielded tile already cashed in half its
 * price up front (yieldTile.ts); selling it on top of that refunds only
 * 40% gold (not another 50%), so yielding then selling nets 90% total gold
 * instead of the 100% a straight sale would give — a real 10% penalty for
 * having yielded first. The garrison itself always comes back in full
 * regardless: those are real troops still standing on the tile, not part
 * of the gold penalty.
 */
export function sellRefund(tile: Tile): { gold: number; units: number } {
  const goldRefundMultiplier = tile.isYielded ? 0.4 : 1;
  return {
    gold: Math.floor(tile.currentPrice.gold * goldRefundMultiplier),
    units: Math.floor(tile.currentPrice.units),
  };
}

export function sellTile(
  gameState: GameState,
  player: Player,
  tile: Tile
): { gold: number; units: number } {
  if (!tile) return { gold: 0, units: 0 };
  if (tile.owner !== player.id) return { gold: 0, units: 0 };

  const { gold: totalGold, units: totalUnits } = sellRefund(tile);

  // Mutate tile and player
  tile.owner = null;
  tile._level = 1;
  tile.isYielded = false;

  player.gold = (player.gold || 0) + totalGold;
  player.units = (player.units || 0) + totalUnits;

  // Remove tile position index from player's ownedTiles list
  const tileIndex = gameState.tiles.indexOf(tile);
  if (tileIndex !== -1) {
    player.ownedTiles = player.ownedTiles.filter((idx) => idx !== tileIndex);
    changeFame(player, -1);
  }

  say(t('sellTile.sold', { playerName: player.name, tileName: tile.name, gold: totalGold, units: totalUnits }), 'info');

  return { gold: totalGold, units: totalUnits };
}
