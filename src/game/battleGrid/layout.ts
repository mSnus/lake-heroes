import {
  AUTO_BATTLE_LARGE_THRESHOLD,
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  BRAWL_COLS,
  BRAWL_ROWS,
  BRAWL_THRESHOLD,
  DRAGON_BATTLEFIELD_COLS,
  DRAGON_BATTLEFIELD_ROWS,
  HUGE_BATTLEFIELD_COLS,
  HUGE_BATTLEFIELD_ROWS,
  MASSIVE_BATTLEFIELD_COLS,
  MASSIVE_BATTLEFIELD_ROWS,
  SMALL_AUTO_BATTLE_THRESHOLD,
  SMALL_BATTLEFIELD_COLS,
  SMALL_BATTLEFIELD_ROWS,
} from '../constants';
import { slotChunks } from '../army';

/** How many formation clusters a militia/riders pair forms -- the groupCount
 * of a 'grouped' formation. */
export function squadGroupCount(militia: number, riders: number): number {
  return Math.max(1, slotChunks(militia).length + slotChunks(riders).length);
}

export interface BattleBoard {
  cols: number;
  rows: number;
  isBrawl: boolean;
  /** The dragon fight's own square board -- see isEncirclement below. */
  isDragonBoard: boolean;
  isSmallAutoBattle: boolean;
  isHugeBattle: boolean;
  /** The huge tier's own top band (see MASSIVE_BATTLEFIELD_ROWS) -- both
   * sides' totals already made it past AUTO_BATTLE_LARGE_THRESHOLD, so this
   * is the tallest board there is. BattleScreen hides the tile icon here:
   * at this height it's the one easy thing to give back. */
  isMassiveBattle: boolean;
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
  opts: { allowBrawl?: boolean; allowSmall?: boolean; isDragon?: boolean } = {}
): BattleBoard {
  const { allowBrawl = true, allowSmall = true, isDragon = false } = opts;

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
  // The huge tier's own top band -- see MASSIVE_BATTLEFIELD_ROWS.
  const isMassiveBattle =
    isHugeBattle &&
    (attackerGridTotal > AUTO_BATTLE_LARGE_THRESHOLD ||
      defenderGridTotal > AUTO_BATTLE_LARGE_THRESHOLD);
  const isLargeAutoBattle =
    !isBrawl &&
    attackerGridTotal <= AUTO_BATTLE_LARGE_THRESHOLD &&
    defenderGridTotal <= AUTO_BATTLE_LARGE_THRESHOLD;

  // The dragon fight is fought as an encirclement in the middle of the
  // board rather than a face-off across it, so it overrides the size tiers
  // entirely with its own square board (see DRAGON_BATTLEFIELD_COLS).
  if (isDragon) {
    return {
      cols: DRAGON_BATTLEFIELD_COLS,
      rows: DRAGON_BATTLEFIELD_ROWS,
      isDragonBoard: true,
      isBrawl: false,
      isSmallAutoBattle: false,
      isHugeBattle: true,
      isMassiveBattle: false,
      isLargeAutoBattle: false,
    };
  }

  return {
    isDragonBoard: false,
    cols: isBrawl
      ? BRAWL_COLS
      : isSmallAutoBattle
        ? SMALL_BATTLEFIELD_COLS
        : isMassiveBattle
          ? MASSIVE_BATTLEFIELD_COLS
          : isHugeBattle
            ? HUGE_BATTLEFIELD_COLS
            : BATTLEFIELD_COLS,
    rows: isBrawl
      ? BRAWL_ROWS
      : isSmallAutoBattle
        ? SMALL_BATTLEFIELD_ROWS
        : isMassiveBattle
          ? MASSIVE_BATTLEFIELD_ROWS
          : isHugeBattle
            ? HUGE_BATTLEFIELD_ROWS
            : BATTLEFIELD_ROWS,
    isBrawl,
    isSmallAutoBattle,
    isHugeBattle,
    isMassiveBattle,
    isLargeAutoBattle,
  };
}
