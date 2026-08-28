import { GameState } from './GameState';
import { Player } from './Player';

/**
 * A player's potential power as a single number, used to rank players
 * against each other (see game/kingsGrace.ts). Deliberately NOT a gold
 * valuation: game/wealth.ts's totalWealth prices an army at its purchase
 * cost, which makes militia dominate the ranking far out of proportion to
 * what an army is actually worth in play.
 */
export const SCORE_PER_FAME = 100;
export const SCORE_PER_MILITIA = 5;
export const SCORE_PER_RIDER = 50;
/** Every owned tile, whatever it produces. */
export const SCORE_PER_TILE = 100;
/** Each level above the first, on any tile. */
export const SCORE_PER_UPGRADE = 50;
/** Camps and Towers (bonusType 'units') instead of SCORE_PER_TILE -- they
 * raise troops rather than gold, which is worth more than a plain estate. */
export const SCORE_PER_UNIT_TILE = 200;
/** Gold is divided by this, rounded down. */
export const SCORE_GOLD_PER_POINT = 20;

/** What one owned tile contributes, before its owner's other holdings. */
export function tileScore(tile: { bonusType?: 'gold' | 'units'; level: number }): number {
  const base = tile.bonusType === 'units' ? SCORE_PER_UNIT_TILE : SCORE_PER_TILE;
  return base + Math.max(0, tile.level - 1) * SCORE_PER_UPGRADE;
}

/**
 * Fame, army (travelling AND garrisoned), owned tiles with their upgrades,
 * and gold on hand -- summed into one comparable figure.
 *
 * Tile ownership is derived from `tile.owner` rather than
 * `player.ownedTiles`, which can be stale after a reload (the same reason
 * computeAnnualReward reads it that way). A yielded tile still counts: it
 * earns nothing while it sits with the King, but it remains the player's
 * property and comes back.
 */
export function playerScore(board: GameState, player: Player): number {
  let militia = player.militia;
  let riders = player.riders;
  let tiles = 0;

  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id) continue;
    tiles += tileScore(tile);
    militia += tile.garrisonMilitia;
    riders += tile.garrisonRiders;
  }

  return (
    player.fame * SCORE_PER_FAME +
    militia * SCORE_PER_MILITIA +
    riders * SCORE_PER_RIDER +
    tiles +
    Math.floor(player.gold / SCORE_GOLD_PER_POINT)
  );
}
