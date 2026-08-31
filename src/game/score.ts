import { GameState } from './GameState';
import { Player } from './Player';
import { syndicateMultiplier } from './syndicate';

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
/** Each level above the first, on a gold-producing tile. */
export const SCORE_PER_UPGRADE = 50;
/** Camps and Towers (bonusType 'units') instead of SCORE_PER_TILE -- they
 * raise troops rather than gold, which is worth more than a plain estate. */
export const SCORE_PER_UNIT_TILE = 200;
/** Each level above the first on a Camp/Tower -- upgrading one compounds
 * the troops it raises, so it is worth more than a gold tile's upgrade. */
export const SCORE_PER_UNIT_UPGRADE = 100;
/** Any artifact, whatever it does -- they are all hard to come by. */
export const SCORE_PER_ARTIFACT = 300;
/** Gold is divided by this, rounded down. */
export const SCORE_GOLD_PER_POINT = 20;
/** Garrisoned troops are stationary -- they hold one tile and can't march,
 * so they rate this fraction of the same unit carried in the field. */
export const SCORE_GARRISON_RATIO = 0.5;
/** Every tile of a completed syndicate is worth this much more -- holding a
 * whole group is worth more than the same tiles scattered. */
export const SCORE_SYNDICATE_MULT = 1.5;

/** What one owned tile contributes, before its owner's other holdings.
 * `inSyndicate` scales the whole figure, upgrades included. */
export function tileScore(
  tile: { bonusType?: 'gold' | 'units'; level: number },
  inSyndicate = false
): number {
  const isUnitTile = tile.bonusType === 'units';
  const base = isUnitTile ? SCORE_PER_UNIT_TILE : SCORE_PER_TILE;
  const perUpgrade = isUnitTile ? SCORE_PER_UNIT_UPGRADE : SCORE_PER_UPGRADE;
  const raw = base + Math.max(0, tile.level - 1) * perUpgrade;
  return Math.round(inSyndicate ? raw * SCORE_SYNDICATE_MULT : raw);
}

/**
 * Fame, army (travelling at full weight, garrisoned at SCORE_GARRISON_RATIO),
 * owned tiles with their upgrades, artifacts, and gold on hand -- summed into
 * one comparable figure.
 *
 * Tile ownership is derived from `tile.owner` rather than
 * `player.ownedTiles`, which can be stale after a reload (the same reason
 * computeAnnualReward reads it that way). A yielded tile still counts: it
 * earns nothing while it sits with the King, but it remains the player's
 * property and comes back.
 */
export function playerScore(board: GameState, player: Player): number {
  let tiles = 0;
  let garrisonMilitia = 0;
  let garrisonRiders = 0;

  // Memoised per group (there are only a handful) rather than re-derived per
  // tile -- and asked of syndicateMultiplier rather than re-implemented, so
  // "is this a syndicate" can't drift from what the rest of the game means.
  const syndicated = new Map<string, boolean>();
  const inSyndicate = (group: string): boolean => {
    let known = syndicated.get(group);
    if (known === undefined) {
      known = syndicateMultiplier(board, player, group) > 1;
      syndicated.set(group, known);
    }

    return known;
  };

  for (const tile of board.tiles) {
    if (!tile || tile.owner !== player.id) continue;
    tiles += tileScore(tile, inSyndicate(tile.group));
    garrisonMilitia += tile.garrisonMilitia;
    garrisonRiders += tile.garrisonRiders;
  }

  const garrison = Math.floor(
    (garrisonMilitia * SCORE_PER_MILITIA + garrisonRiders * SCORE_PER_RIDER) *
      SCORE_GARRISON_RATIO
  );

  return (
    player.fame * SCORE_PER_FAME +
    player.militia * SCORE_PER_MILITIA +
    player.riders * SCORE_PER_RIDER +
    garrison +
    tiles +
    player.artifacts.length * SCORE_PER_ARTIFACT +
    Math.floor(player.gold / SCORE_GOLD_PER_POINT)
  );
}

/** The strongest player by score. Null only when there are no players. */
export function strongestPlayer(board: GameState): Player | null {
  return board.players.reduce<Player | null>(
    (best, p) => (best === null || playerScore(board, p) > playerScore(board, best) ? p : best),
    null
  );
}

/** The weakest player by score. Null only when there are no players. */
export function weakestPlayer(board: GameState): Player | null {
  return board.players.reduce<Player | null>(
    (worst, p) => (worst === null || playerScore(board, p) < playerScore(board, worst) ? p : worst),
    null
  );
}
