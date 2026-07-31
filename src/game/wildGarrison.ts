import { GameState } from './GameState';

const REGROWTH_TURNS = 10;
const GROWTH_PER_BLOCK = 0.1;

/**
 * Tiles that were razed sit at their authored baseline garrison right away
 * (restored at raze time, see resolveTileBattle.ts) and, if never reclaimed,
 * grow +10% for every further REGROWTH_TURNS turns still unclaimed.
 * Never-claimed tiles (unclaimedSinceTurn undefined) already sit at their
 * baseline from Tile's constructor and are left untouched here.
 */
export function tickWildGarrisons(board: GameState): void {
  for (const tile of board.tiles) {
    if (!tile || tile.owner || tile.unclaimedSinceTurn === undefined) continue;

    const turnsUnclaimed = board.turns - tile.unclaimedSinceTurn;
    const extraBlocks = Math.floor(turnsUnclaimed / REGROWTH_TURNS);
    tile.garrison = Math.ceil(tile.baseGarrison * Math.pow(1 + GROWTH_PER_BLOCK, extraBlocks));
  }
}
