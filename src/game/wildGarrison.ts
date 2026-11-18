import { GameState } from './GameState';
import { TURNS_PER_YEAR } from './constants';
import { armyCapacityForFame } from './army';

const GROWTH_PER_YEAR = 0.1;
// Growth stops at the militia cap of a fame-2 player, so low-fame players are never locked out.
const CAP_FAME = 2;

/**
 * Tiles that were razed sit at their authored baseline garrison right away
 * (restored at raze time, see resolveTileBattle.ts) and, if never reclaimed,
 * grow +10% for every further year still unclaimed, up to CAP_FAME's militia
 * cap (a tile authored above it just stays at its baseline).
 * Never-claimed tiles (unclaimedSinceTurn undefined) already sit at their
 * baseline from Tile's constructor and are left untouched here.
 */
export function tickWildGarrisons(board: GameState): void {
  const turnsPerYear = TURNS_PER_YEAR * Math.max(1, board.players.length);
  const cap = armyCapacityForFame(CAP_FAME).militia;
  for (const tile of board.tiles) {
    if (!tile || tile.owner || tile.unclaimedSinceTurn === undefined) continue;

    const years = Math.floor((board.turns - tile.unclaimedSinceTurn) / turnsPerYear);
    const grown = Math.ceil(tile.baseGarrison * Math.pow(1 + GROWTH_PER_YEAR, years));
    tile.garrison = Math.min(grown, Math.max(tile.baseGarrison, cap));
  }
}
