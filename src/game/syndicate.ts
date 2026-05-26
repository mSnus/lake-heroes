import { GameState } from './GameState';
import { Player } from './Player';

/**
 * Returns 2 if the player owns every ownable tile in the given group (syndicate),
 * otherwise 1.
 */
export function syndicateMultiplier(
  board: GameState,
  player: Player,
  group: string | undefined
): number {
  if (!group) return 1;
  const total = board.tiles.filter((t) => t?.isOwnable && t.group === group).length;
  if (total === 0) return 1;
  const owned = player.ownedTiles.filter((idx) => {
    const t = board.tiles[idx];
    return t?.isOwnable && t.group === group && t.owner === player.name;
  }).length;
  return owned >= total ? 2 : 1;
}
