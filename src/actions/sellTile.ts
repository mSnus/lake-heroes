import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { UNIT_PRICE, RIDER_UNIT_PRICE } from '../game/constants';
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
 * having yielded first. Units returned are the current garrison, which comes
 * back in full regardless of the gold penalty.
 */
export function sellRefund(tile: Tile): { gold: number; units: number } {
  const goldRefundMultiplier = tile.isYielded ? 0.4 : 1;
  return {
    gold: Math.floor(tile.currentPrice.gold * goldRefundMultiplier),
    units: tile.garrisonMilitia + tile.garrisonRiders,
  };
}

export function sellTile(
  gameState: GameState,
  player: Player,
  tile: Tile
): { gold: number; units: number; soldForGold: number } {
  if (!tile) return { gold: 0, units: 0, soldForGold: 0 };
  if (tile.owner !== player.id) return { gold: 0, units: 0, soldForGold: 0 };

  const { gold: totalGold } = sellRefund(tile);

  // Capture garrison before clearing ownership.
  const gm = tile.garrisonMilitia;
  const gr = tile.garrisonRiders;

  tile.owner = null;
  tile._level = 1;
  tile.isYielded = false;
  tile.garrisonMilitia = 0;
  tile.garrisonRiders = 0;

  player.gold = (player.gold || 0) + totalGold;
  player.militia += gm;
  player.riders += gr;

  const tileIndex = gameState.tiles.indexOf(tile);
  if (tileIndex !== -1) {
    player.ownedTiles = player.ownedTiles.filter((idx) => idx !== tileIndex);
    changeFame(player, -1);
  }

  // After the fame drop, cap the army to the new limits — excess sold for gold.
  const cap = player.armyCapacity;
  let soldForGold = 0;

  if (player.militia > cap.militia) {
    const excess = player.militia - cap.militia;
    player.militia = cap.militia;
    soldForGold += excess * UNIT_PRICE;
  }

  if (player.riders > cap.riders) {
    const excess = player.riders - cap.riders;
    player.riders = cap.riders;
    soldForGold += excess * RIDER_UNIT_PRICE;
  }

  player.gold += soldForGold;

  const totalUnits = gm + gr;
  say(t('sellTile.sold', { playerName: player.name, tileName: tile.name, gold: totalGold, units: totalUnits }), 'info');

  return { gold: totalGold, units: totalUnits, soldForGold };
}
