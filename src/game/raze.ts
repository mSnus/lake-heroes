import { GameState } from './GameState';
import { Tile } from './Tile';

/**
 * Burn a tile back to unowned, zombie-guarded wilderness: nobody owns it,
 * its upgrades are gone, its wild garrison is restored to the authored
 * baseline, and it stays on fire (unbuyable) for the rest of the round.
 * Shared by every raze -- a won battle, a rogue horde, and a dragon that
 * destroys a level-1 tile.
 */
export function razeTile(board: GameState, tile: Tile): void {
  const tileIdx = board.tiles.indexOf(tile);
  board.players.forEach((p) => {
    p.ownedTiles = p.ownedTiles.filter((i) => i !== tileIdx);
  });

  tile.owner = null;
  tile._level = 1;
  tile.isYielded = false;
  tile.garrison = tile.baseGarrison;
  tile.unclaimedSinceTurn = board.turns;
  tile.razedInRound = board.round;
  tile.abandoned = true;
}
