import { GameState } from './GameState';
import { Player } from './Player';
import { Tile } from './Tile';
import { MONEY_PASS_START, MONEY_PASS_START_FAME, TURN_DEFAULT_GOLD, TURN_DEFAULT_UNITS } from './constants';
import { syndicateMultiplier } from './syndicate';

/**
 * A single owned tile's per-turn income: its own bonus (gold for Mills/
 * Farms/Fields/Traders, units for Camps/Towers) at its current level, plus a
 * flat trickle of the opposite resource -- the same flat amount regardless
 * of tile type, so every units-bonus tile (Camps and Towers alike) earns
 * identical gold. A yielded tile earns nothing. `mult` is the syndicate
 * multiplier already resolved by the caller (board/player-aware for a real
 * owner; 1 for an unowned tile's preview) -- applied only to the tile's own
 * resource, matching the King's-grace reward's old behavior. Shared by the
 * actual per-turn payout (collectTileTurnIncome) and TileCard's preview, so
 * they can't drift apart.
 */
export function tileTurnIncome(tile: Tile, mult: number = 1): { gold: number; units: number } {
  if (tile.isYielded) return { gold: 0, units: 0 };
  const own = (tile.bonuses[tile.level] ?? 0) * mult;
  return tile.bonusType === 'units'
    ? { gold: TURN_DEFAULT_GOLD, units: own }
    : { gold: own, units: TURN_DEFAULT_UNITS };
}

/**
 * Grant a player their per-turn income from every tile they own, applied
 * directly to their gold/units. Called once at the start of their turn (see
 * endTurn.ts) -- tile income no longer waits for a lap around the board, only
 * the King's own grace does (see kingsGrace.ts's computeAnnualReward).
 * Derives ownership from tile.owner (authoritative) rather than
 * player.ownedTiles, which can be stale after a reload.
 */
export function collectTileTurnIncome(board: GameState, player: Player): { gold: number; units: number } {
  let gold = 0;
  let units = 0;
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id) continue;
    const income = tileTurnIncome(tile, syndicateMultiplier(board, player, tile.group));
    gold += income.gold;
    units += income.units;
  }
  player.gold += gold;
  player.units += units;
  return { gold, units };
}

/**
 * A player's projected per-lap (King's Castle) income preview -- the King's
 * own grace only; tile bonuses aren't part of it any more (they pay out per
 * turn instead, see collectTileTurnIncome). Used by CurrentPlayerCard's
 * popup for a player other than the one taking their turn.
 */
export function playerIncome(player: Player): { gold: number; units: number } {
  const gold = MONEY_PASS_START + MONEY_PASS_START_FAME * player.fame;
  const units = player.fame ?? 1;
  return { gold, units };
}
