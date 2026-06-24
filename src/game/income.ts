import { GameState } from './GameState';
import { Player } from './Player';
import { MONEY_PASS_START, MONEY_PASS_START_FAME } from './constants';
import { syndicateMultiplier } from './syndicate';

/**
 * A player's per-year income (collected when passing the King's Castle): the
 * King's base grant plus every owned tile's bonus (doubled for syndicates).
 * Mirrors the reward logic in passStart.ts.
 */
export function playerIncome(board: GameState, player: Player): { gold: number; units: number } {
  let gold = MONEY_PASS_START + MONEY_PASS_START_FAME * player.fame;
  let units = player.fame ?? 1;

  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile) continue;
    const bonus = tile.bonuses[tile.level] ?? 0;
    const mult = syndicateMultiplier(board, player, tile.group);
    if ((tile.bonusType || 'gold') === 'units') {
      units += bonus * mult;
    } else {
      gold += bonus * mult;
    }
  }

  return { gold, units };
}

export function playerIncomeGold(board: GameState, player: Player): number {
  let { gold, units } = playerIncome(board, player);

  return gold;
}

export function playerIncomeUnits(board: GameState, player: Player): number {
  let { gold, units } = playerIncome(board, player);

  return units;
}
