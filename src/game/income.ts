import { GameState } from './GameState';
import { Player } from './Player';
import { Tile } from './Tile';
import { syndicateMultiplier } from './syndicate';

/**
 * A single owned tile's per-turn income: its own bonus (gold for Mills/
 * Farms/Fields/Traders, units for Camps/Towers) at its current level -- the
 * flat opposite-resource trickle (Towers/Camps' little bit of gold, a
 * gold-tile's little bit of units) is granted once a lap instead, as part of
 * the King's-grace reward (see kingsGrace.ts's computeAnnualReward). A
 * yielded tile earns nothing. `mult` is the syndicate multiplier already
 * resolved by the caller (board/player-aware for a real owner; 1 for an
 * unowned tile's preview). Shared by the actual per-turn payout
 * (collectTileTurnIncome) and TileCard's preview, so they can't drift apart.
 */
export function tileTurnIncome(tile: Tile, mult: number = 1): { gold: number; units: number } {
  if (tile.isYielded) return { gold: 0, units: 0 };
  const own = (tile.bonuses[tile.level] ?? 0) * mult;
  return tile.bonusType === 'units' ? { gold: 0, units: own } : { gold: own, units: 0 };
}

/**
 * Grant a player their per-turn income from every tile they own, applied
 * directly to their gold/units. Called once at the start of their turn (see
 * endTurn.ts) -- a tile's own income no longer waits for a lap around the
 * board. Derives ownership from tile.owner (authoritative) rather than
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
