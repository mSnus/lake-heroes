import { GameState } from './GameState';
import { Player } from './Player';
import { resourcesGoldValue, unitGoldValue } from './resources';

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
 * at its full recipe (see unitGoldValue), plus cumulative tile unit-costs at
 * a militia's value, plus food/arms and gold on hand.
 */
export function totalWealth(board: GameState, player: Player): number {
  const w = playerWealth(board, player);
  const militiaValue = unitGoldValue('militia');
  const armyValue = player.militia * militiaValue + player.riders * unitGoldValue('riders');
  const tileUnitsValue = (w.units - player.units) * militiaValue;
  return w.gold + armyValue + tileUnitsValue + resourcesGoldValue(player);
}

/* Ranking players is done on power score now, not gold -- see
 * game/score.ts's strongestPlayer/weakestPlayer. totalWealth above survives
 * purely as a displayed figure (the 🧮 line on the realm overview). */
