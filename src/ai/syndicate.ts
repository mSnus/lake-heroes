import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';

const EXCLUDED_GROUPS = ['Towers', 'Camps'];

/**
 * If `tile` is the last unowned tile of its group (claiming it would complete
 * a syndicate) and is unaffordable ONLY on the gold dimension, find a single
 * owned tile to sell that would cover the shortfall.
 *
 * Heuristic (intentionally simple):
 *  - Candidate pool: the player's owned tiles, excluding the "Towers"/"Camps"
 *    groups, and excluding any tile that is itself the last-remaining tile of
 *    another group (so completing one syndicate never breaks another).
 *  - Among candidates whose `currentPrice.gold` covers the shortfall, pick the
 *    cheapest (least currentPrice.gold); ties broken by lowest tile index.
 *  - Returns null if `tile` isn't a last-needed tile, isn't gold-blocked only,
 *    or no single candidate suffices.
 */
export function findSyndicateSaleCandidate(
  board: GameState,
  player: Player,
  tile: Tile
): Tile | null {
  if (tile.isOwned()) return null;

  const groupTiles = board.tiles.filter((t) => t?.isOwnable && t.group === tile.group);
  const unownedInGroup = groupTiles.filter((t) => !t.isOwned());
  if (unownedInGroup.length !== 1 || unownedInGroup[0] !== tile) return null; // not last-needed

  const goldShortfall = tile.prices['1'].gold - player.gold;
  if (goldShortfall <= 0) return null; // already affordable on gold

  // Confirm gold is the ONLY blocker.
  const lvl1Defence = tile.getDefence(1);
  if (player.armyPower < lvl1Defence) return null;
  if (player.fame < tile.requiredFame) return null;

  // Groups the player is one tile away from completing (excluding tile's own group).
  const groupNames = Array.from(new Set(board.tiles.filter((t) => t?.isOwnable).map((t) => t.group)));
  const nearCompleteGroups = new Set<string>();
  for (const g of groupNames) {
    if (g === tile.group) continue;
    const tiles = board.tiles.filter((t) => t?.isOwnable && t.group === g);
    const unowned = tiles.filter((t) => !t.isOwned());
    if (unowned.length === 1) nearCompleteGroups.add(g);
  }

  const isLastNeededFor = (ownedTile: Tile): boolean => {
    const tiles = board.tiles.filter((t) => t?.isOwnable && t.group === ownedTile.group);
    const unowned = tiles.filter((t) => !t.isOwned() && t !== ownedTile);
    return unowned.length === 0;
  };

  const candidates = player.ownedTiles
    .map((idx) => board.tiles[idx])
    .filter((t): t is Tile => !!t && t.owner === player.id)
    .filter((t) => !EXCLUDED_GROUPS.includes(t.group))
    .filter((t) => !(nearCompleteGroups.has(t.group) && isLastNeededFor(t)))
    .filter((t) => t.currentPrice.gold >= goldShortfall);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.currentPrice.gold - b.currentPrice.gold);
  return candidates[0];
}
