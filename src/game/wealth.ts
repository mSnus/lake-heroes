import { GameState } from './GameState';
import { Player } from './Player';
import { getOverrides } from '../utils/overridesStore';

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
 * A player's total wealth expressed in gold — their own army valued by tier
 * (militia at UNIT_PRICE, riders at the pricier RIDER_UNIT_PRICE), plus
 * cumulative tile unit-costs at the generic UNIT_PRICE, plus gold on hand.
 */
export function totalWealth(board: GameState, player: Player): number {
  const w = playerWealth(board, player);
  const ov = getOverrides();
  const armyValue = player.militia * ov.militiaPrice + player.riders * ov.riderPrice;
  const tileUnitsValue = (w.units - player.units) * ov.militiaPrice;
  return w.gold + armyValue + tileUnitsValue;
}

/* Ranking players is done on power score now, not gold -- see
 * game/score.ts's strongestPlayer/weakestPlayer. totalWealth above survives
 * purely as a displayed figure (the 🧮 line on the realm overview). */
