import { GameState } from './GameState';
import { Player } from './Player';
import { Tile } from './Tile';
import { FLAT_TILE_UNIT_INCOME } from './constants';
import { syndicateMultiplier } from './syndicate';
import { hasArtifact } from './artifacts';
import { hasYearEffect, currentYear, NO_GOLD_INCOME_EFFECT, NO_UNIT_INCOME_EFFECT, DOUBLE_INCOME_EFFECT } from './yearCore';

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
 *
 * `board`, when given, folds in the shared calendar (see game/year.ts):
 * this year's lucky groups double the tile's own bonus (not the flat
 * trickle -- that's not the "profit" the bonus is about), and a live
 * Joker Taxes/Plague zeroes gold/units outright, overriding everything
 * else including the double. Omitted entirely by the one caller with no
 * live game to check (HelpScreen's static demo tile card), which then
 * behaves exactly as if no year effect were ever in force.
 *
 * `player`, when given alongside `board`, is checked for the two artifacts
 * that exempt a holder from a live Plague (NO_UNIT_INCOME_EFFECT)
 * specifically -- Taxes has no artifact protection and never did, so gold
 * suppression is unconditional. Pipe of Hamelin protects live, every turn,
 * for as long as it's held. Divine Beads is a one-shot 50% roll taken once
 * when Plague fires (see actions/joker.ts), stamped onto
 * player.plagueImmuneUntilYear rather than re-rolled here -- re-rolling
 * every turn would make the protection flicker on and off.
 */
export function tileTurnIncome(
  tile: Tile,
  mult: number = 1,
  level: number = tile.level,
  board?: GameState,
  player?: Player
): { gold: number; units: number } {
  if (tile.isYielded) return { gold: 0, units: 0 };
  const groupBoost = board && hasYearEffect(board, DOUBLE_INCOME_EFFECT, tile.group) ? 2 : 1;
  const own = (tile.bonuses[level] ?? 0) * mult * groupBoost;
  const result =
    tile.bonusType === 'units'
      ? { gold: 0, units: own + FLAT_TILE_UNIT_INCOME }
      : { gold: own, units: FLAT_TILE_UNIT_INCOME };

  if (board && hasYearEffect(board, NO_GOLD_INCOME_EFFECT)) result.gold = 0;
  const plagueImmune =
    !!player &&
    (hasArtifact(player, 'pipe-of-hamelin') ||
      (!!board &&
        player.plagueImmuneUntilYear !== undefined &&
        player.plagueImmuneUntilYear >= currentYear(board)));
  if (board && hasYearEffect(board, NO_UNIT_INCOME_EFFECT) && !plagueImmune) result.units = 0;
  return result;
}

/**
 * A player's total per-turn income across every tile they own -- read-only,
 * used both by collectTileTurnIncome (the actual payout) and by the stats
 * panel's preview (CurrentPlayer.tsx, TurnAnnouncement.tsx), so they can't
 * drift apart. Derives ownership from tile.owner (authoritative) rather than
 * player.ownedTiles, which can be stale after a reload.
 *
 * `units` is capped to the player's remaining militia cap (income always
 * lands on militia -- see Player's `units` setter) so a full-or-nearly-full
 * army's preview matches what will actually be granted, rather
 * than promising units the militia cap will silently swallow.
 */
export function playerTurnIncome(board: GameState, player: Player): { gold: number; units: number } {
  const raw = playerRawTurnIncome(board, player);
  return { gold: raw.gold, units: Math.min(raw.units, player.armyRoom('militia')) };
}

/**
 * What the player's tiles actually produce per turn, BEFORE the army-
 * capacity clamp playerTurnIncome applies. Use this to judge how productive
 * an estate is (see ai/decisions.ts's garrison rules) -- the clamped figure
 * reads 0 for a full army, which would say "produces nothing" exactly when
 * the estate is at its most productive.
 */
export function playerRawTurnIncome(board: GameState, player: Player): { gold: number; units: number } {
  let gold = 0;
  let units = 0;
  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id) continue;
    const income = tileTurnIncome(tile, syndicateMultiplier(board, player, tile.group), undefined, board, player);
    gold += income.gold;
    units += income.units;
  }

  // Rounded down to a clean 5 -- both the real per-turn grant and every
  // preview reading this (CurrentPlayer.tsx, TurnAnnouncement.tsx, etc.)
  // share this function, so they stay in sync automatically.
  return { gold: Math.floor(gold / 5) * 5, units };
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
