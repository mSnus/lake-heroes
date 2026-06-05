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

  const groupTiles = board.tiles.filter((t) => t?.isOwnable && t.group === group);

  if (groupTiles.length === 0) return 1;

  // Derive ownership from tile.owner (authoritative) rather than
  // player.ownedTiles, which can be stale after a reload.
  const ownsAll = groupTiles.every((t) => t.owner === player.name);

  return ownsAll ? 2 : 1;
}
