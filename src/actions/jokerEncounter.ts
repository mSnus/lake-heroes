import { GameState } from '../game/GameState';
import { handleJoker } from './joker';

const ENCOUNTER_CHANCE = 0.05;
// Only once every player at the table is a real contender -- a brand-new
// player isn't at risk of a random Taxes/Plague/Hurricane this early.
const MIN_FAME = 5;

/**
 * The Joker can also strike at random, before movement -- the same event
 * table and screen as landing on its own tile (see actions/joker.ts's
 * handleJoker, reused here unchanged), just a second, rarer way in.
 */
export function checkJokerEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  force = false
): boolean {
  if (!force) {
    if (board.players.some((p) => p.fame < MIN_FAME)) return false;
    if (Math.random() >= ENCOUNTER_CHANCE) return false;
  }

  handleJoker(board, updateGameState, onContinue);
  return true;
}
