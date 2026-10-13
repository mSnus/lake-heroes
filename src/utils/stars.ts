import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { say } from './say';

/** Stars needed to win the game outright -- same finish line the Dragon's
 * instant win already reaches by its own route (see resolveDragonBattle.ts). */
export const STARS_TO_WIN = 3;

/**
 * Adjust a player's star count and log when it actually changes. Reaching
 * STARS_TO_WIN ends the game immediately, the same way slaying the Dragon
 * does -- `board.winner`/`board.winCondition` record who and how, since
 * (unlike the Dragon fight) the player earning the winning star is not
 * necessarily `board.activePlayer`.
 */
export function changeStars(board: GameState, player: Player, delta: number): void {
  if (delta === 0) return;

  const before = player.stars;
  const after = Math.max(0, before + delta);
  if (after === before) return;

  player.stars = after;
  say(`${player.name} earns a star ⭐ (${after}/${STARS_TO_WIN})`, 'success');

  if (after >= STARS_TO_WIN && !board.gameOver) {
    board.gameOver = true;
    board.winner = player.id;
    board.winCondition = 'stars';
  }
}
