import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { t } from '../i18n';

export function sellTile(
  gameState: GameState,
  player: Player,
  tile: Tile
): { gold: number; units: number } {
  if (!tile) return { gold: 0, units: 0 };
  if (tile.owner !== player.id) return { gold: 0, units: 0 };

  // Refund = the tile's currentPrice (base level's units mirrors its
  // defence, same as isAffordable(); upgrade levels refund their price).
  // A yielded tile already cashed in half its price up front, so selling it
  // on top of that only refunds half of what a normal sale would.
  const refundMultiplier = tile.isYielded ? 0.5 : 1;
  const totalGold = Math.floor(tile.currentPrice.gold * refundMultiplier);
  const totalUnits = Math.floor(tile.currentPrice.units * refundMultiplier);

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
