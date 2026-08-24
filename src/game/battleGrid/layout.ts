import {
  AUTO_BATTLE_LARGE_THRESHOLD,
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  BRAWL_COLS,
  BRAWL_ROWS,
  BRAWL_THRESHOLD,
  HUGE_BATTLEFIELD_COLS,
  HUGE_BATTLEFIELD_ROWS,
  SMALL_AUTO_BATTLE_THRESHOLD,
  SMALL_BATTLEFIELD_COLS,
  SMALL_BATTLEFIELD_ROWS,
} from '../constants';
import { buildSquadChunks } from '../army';

/** How many non-empty squads a militia/riders pair forms -- the groupCount
 * of a 'grouped' formation. Slot count only pads the chunk list with empty
 * squads, which are filtered out, so it doesn't affect the result. */
export function squadGroupCount(militia: number, riders: number): number {
  return Math.max(1, buildSquadChunks(militia, riders, 0).filter((c) => c.count > 0).length);
}

export interface BattleBoard {
  cols: number;
  rows: number;
  isBrawl: boolean;
  isSmallAutoBattle: boolean;
  isHugeBattle: boolean;
  isLargeAutoBattle: boolean;
}

/**
 * The board tier a fight is played on, from each side's grid headcount.
 * Single source of truth shared by the live battle screen and the battle
 * simulator, so a simulated fight always lands on the same board a real one
 * would -- board size shifts the result noticeably, and the two drifting
 * apart is exactly what makes simulated odds stop matching real ones.
 *
 * `allowBrawl` / `allowSmall` mirror BattleScreen's per-mode gating -- e.g.
 * ambush's triangle wedge needs more height than a grouped formation at the
 * same headcount, so it stays off the small board.
 */
export function battleBoardFor(
  attackerGridTotal: number,
  defenderGridTotal: number,
  opts: { allowBrawl?: boolean; allowSmall?: boolean } = {}
): BattleBoard {
  const { allowBrawl = true, allowSmall = true } = opts;

  const isBrawl =
    allowBrawl && attackerGridTotal <= BRAWL_THRESHOLD && defenderGridTotal <= BRAWL_THRESHOLD;
  const isSmallAutoBattle =
    allowSmall &&
    !isBrawl &&
    attackerGridTotal < SMALL_AUTO_BATTLE_THRESHOLD &&
    defenderGridTotal < SMALL_AUTO_BATTLE_THRESHOLD;
  // Either side being this big is enough: a 50-unit grouped formation needs
  // ~19 rows on its own, and gets clamped into overlap on the standard
  // board no matter how small the army facing it is.
  const isHugeBattle =
    !isBrawl &&
    !isSmallAutoBattle &&
    (attackerGridTotal > SMALL_AUTO_BATTLE_THRESHOLD ||
      defenderGridTotal > SMALL_AUTO_BATTLE_THRESHOLD);
  const isLargeAutoBattle =
    !isBrawl &&
    attackerGridTotal <= AUTO_BATTLE_LARGE_THRESHOLD &&
    defenderGridTotal <= AUTO_BATTLE_LARGE_THRESHOLD;

  return {
    cols: isBrawl
      ? BRAWL_COLS
      : isSmallAutoBattle
        ? SMALL_BATTLEFIELD_COLS
        : isHugeBattle
          ? HUGE_BATTLEFIELD_COLS
          : BATTLEFIELD_COLS,
    rows: isBrawl
      ? BRAWL_ROWS
      : isSmallAutoBattle
        ? SMALL_BATTLEFIELD_ROWS
        : isHugeBattle
          ? HUGE_BATTLEFIELD_ROWS
          : BATTLEFIELD_ROWS,
    isBrawl,
    isSmallAutoBattle,
    isHugeBattle,
    isLargeAutoBattle,
  };
}
