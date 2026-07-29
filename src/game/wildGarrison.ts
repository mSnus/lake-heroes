import { GameState } from './GameState';

const REGROWTH_TURNS = 10;
const GROWTH_PER_BLOCK = 0.1;

/**
 * Tiles that were razed and never reclaimed grow wild again over time:
 * empty for the first REGROWTH_TURNS turns, then back to their authored
 * baseline garrison, then +10% for every further REGROWTH_TURNS turns still
 * unclaimed. Never-claimed tiles (unclaimedSinceTurn undefined) already sit
 * at their baseline from Tile's constructor and are left untouched here.
 */
export function tickWildGarrisons(board: GameState): void {
  for (const tile of board.tiles) {
    if (!tile || tile.owner || tile.unclaimedSinceTurn === undefined) continue;

    const turnsUnclaimed = board.turns - tile.unclaimedSinceTurn;
    if (turnsUnclaimed < REGROWTH_TURNS) {
      tile.garrison = 0;
      continue;
    }

    const extraBlocks = Math.floor((turnsUnclaimed - REGROWTH_TURNS) / REGROWTH_TURNS);
    tile.garrison = Math.ceil(tile.baseGarrison * Math.pow(1 + GROWTH_PER_BLOCK, extraBlocks));
  }
}
