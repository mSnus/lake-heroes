import { Player } from '../game/Player';
import { say } from './say';

// Fame at or above this makes the player a knight (rider sprite).
export const KNIGHT_FAME = 4;

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

  if (after > before) {
    say(`${player.name} becomes more famous`, 'success');
  } else {
    say(`${player.name} becomes less famous`, 'warning');
  }

  // Knighthood threshold crossings.
  if (before < KNIGHT_FAME && after >= KNIGHT_FAME) {
    say(`${player.name} is promoted to the knight!`, 'success');
  } else if (before >= KNIGHT_FAME && after < KNIGHT_FAME) {
    say(`${player.name} is demoted from knights`, 'warning');
  }
}
