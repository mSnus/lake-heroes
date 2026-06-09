import { Player } from '../game/Player';
import { say } from './say';
import { KNIGHT_FAME } from '../game/constants';

export { KNIGHT_FAME };

/**
 * Adjust a player's fame and log when it actually changes. `floor` clamps the
 * minimum (most callers use 1; a few allow 0).
 */
export function changeFame(player: Player, delta: number, floor = 1): void {
  if (delta === 0) return;

  const before = player.fame;
  const after = Math.max(floor, before + delta);
  if (after === before) return;

  player.fame = after;

  // Fold any knighthood threshold crossing into the same fame-change message.
  if (after > before) {
    const knighted = before < KNIGHT_FAME && after >= KNIGHT_FAME;
    say(
      `${player.name} becomes more famous${knighted ? ' and was promoted to a Knight!' : ''}`,
      'success'
    );
  } else {
    const demoted = before >= KNIGHT_FAME && after < KNIGHT_FAME;
    say(
      `${player.name} becomes less famous${demoted ? ' and was demoted from knights' : ''}`,
      'warning'
    );
  }
}
