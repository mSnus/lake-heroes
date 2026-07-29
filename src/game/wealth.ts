import { GameState } from './GameState';
import { Player } from './Player';
import { RIDER_UNIT_PRICE, UNIT_PRICE } from './constants';

// A player's wealth is what they hold (gold/units) plus the full price paid for
// every owned tile and its upgrades.
export function playerWealth(board: GameState, player: Player): { gold: number; units: number } {
  let gold = player.gold;
  let units = player.units;
  for (const idx of player.ownedTiles) {
    const t = board.tiles[idx];
    if (!t) continue;
    gold += t.currentPrice.gold;
    units += t.currentPrice.units;
  }
  return { gold, units };
}

/**
 * The wealthiest player ranked by total wealth expressed in gold — the
 * player's own army valued by tier (militia at UNIT_PRICE, riders at the
 * pricier RIDER_UNIT_PRICE), cumulative tile unit-costs at the generic
 * UNIT_PRICE. Returns null only when there are no players.
 */
export function richestPlayer(board: GameState): Player | null {
  let best: Player | null = null;
  let bestTotal = -1;
  for (const p of board.players) {
    const w = playerWealth(board, p);
    const armyValue = p.militia * UNIT_PRICE + p.riders * RIDER_UNIT_PRICE;
    const tileUnitsValue = (w.units - p.units) * UNIT_PRICE;
    const total = w.gold + armyValue + tileUnitsValue;
    if (total > bestTotal) {
      bestTotal = total;
      best = p;
    }
  }
  return best;
}
