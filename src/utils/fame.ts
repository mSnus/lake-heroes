import { Player } from '../game/Player';
import { say } from './say';
import { KNIGHT_FAME } from '../game/constants';

export { KNIGHT_FAME };

/**
 * Adjust a player's fame and log when it actually changes. `floor` clamps the
 * minimum (most callers use 1; a few allow 0). `silent` skips this function's
 * own toast -- for a caller folding the change into a combined message of
 * its own instead (see actions/becomeBeggar.ts).
 */
export function changeFame(player: Player, delta: number, floor = 1, silent = false): void {
  if (delta === 0) return;

  const before = player.fame;
  const after = Math.max(floor, before + delta);
  if (after === before) return;

  player.fame = after;
  if (silent) return;

  // Fold any knighthood threshold crossing into the same fame-change message.
  if (after > before) {
    const knighted = before < KNIGHT_FAME && after >= KNIGHT_FAME;
    say(
      `${player.name} is now of fame ${after}🏆${knighted ? ' and was promoted to a Knight!' : ''}`,
      'debug'
    );
  } else {
    const demoted = before >= KNIGHT_FAME && after < KNIGHT_FAME;
    say(
      `${player.name} is now of fame ${after}🏆${demoted ? ' and was demoted from knights' : ''}`,
      'warning'
    );
  }
}
