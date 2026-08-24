import { GameState } from './GameState';
import { Player } from './Player';
import { Tile } from './Tile';
import { FLAT_TILE_UNIT_INCOME } from './constants';
import { syndicateMultiplier } from './syndicate';

/**
 * A single owned tile's per-turn income: its own bonus (gold for Mills/
 * Farms/Fields/Traders, units for Camps/Towers) at its current level, plus a
 * flat FLAT_TILE_UNIT_INCOME militia every tile brings in regardless of
 * type -- the flat opposite-resource GOLD trickle (Towers/Camps' little bit
 * of gold) is granted once a lap instead, as part of the King's-grace reward
 * (see kingsGrace.ts's computeAnnualReward). A yielded tile earns nothing.
 * `mult` is the syndicate multiplier already resolved by the caller
 * (board/player-aware for a real owner; 1 for an unowned tile's preview) --
 * applied only to the tile's own bonus, not the flat trickle. Shared by the
 * actual per-turn payout (collectTileTurnIncome) and TileCard's preview, so
 * they can't drift apart. `level` defaults to the tile's current level, but
 * can be overridden to preview a not-yet-reached upgrade level (see
 * TileClaimScreen's level-2/3 preview rows).
 */
export function tileTurnIncome(
  tile: Tile,
  mult: number = 1,
  level: number = tile.level
): { gold: number; units: number } {
  if (tile.isYielded) return { gold: 0, units: 0 };
  const own = (tile.bonuses[level] ?? 0) * mult;
  return tile.bonusType === 'units'
    ? { gold: 0, units: own + FLAT_TILE_UNIT_INCOME }
    : { gold: own, units: FLAT_TILE_UNIT_INCOME };
}

/**
 * A player's total per-turn income across every tile they own -- read-only,
 * used both by collectTileTurnIncome (the actual payout) and by the stats
 * panel's preview (CurrentPlayer.tsx, TurnAnnouncement.tsx), so they can't
 * drift apart. Derives ownership from tile.owner (authoritative) rather than
 * player.ownedTiles, which can be stale after a reload.
 *
 * `units` is capped to the player's remaining militia slot capacity (income
 * always lands on militia -- see Player's `units` setter) so a full-or-
 * nearly-full squad's preview matches what will actually be granted, rather
 * than promising units the squad limit will silently swallow.
 */
export function playerTurnIncome(board: GameState, player: Player): { gold: number; units: number } {
  let gold = 0;
  let units = 0;
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id) continue;
    const income = tileTurnIncome(tile, syndicateMultiplier(board, player, tile.group));
    gold += income.gold;
    units += income.units;
  }
  // Rounded down to a clean 50 -- both the real per-turn grant and every
  // preview reading this (CurrentPlayer.tsx, TurnAnnouncement.tsx, etc.)
  // share this function, so they stay in sync automatically.
  gold = Math.floor(gold / 50) * 50;
  return { gold, units: Math.min(units, player.remainingCapacity('militia')) };
}

/**
 * Grant a player their per-turn income from every tile they own, applied
 * directly to their gold/units. Called once at the start of their turn (see
 * endTurn.ts) -- a tile's own income no longer waits for a lap around the
 * board.
 */
export function collectTileTurnIncome(board: GameState, player: Player): { gold: number; units: number } {
  const income = playerTurnIncome(board, player);
  player.gold += income.gold;
  player.units += income.units;
  return income;
}
