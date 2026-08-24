import { GameState } from '../game/GameState';
import { isHeadlessRun } from './headlessStore';
import { recordSimLog } from './simLogStore';

/** Sets the banner message shown under the board, and mirrors it into the
 * per-circle sim log during a headless run -- same treatment say() already
 * gives toasts, so important game-message-only events aren't invisible to
 * the economy simulator's results table. */
export function setGameMessage(board: GameState, message: string): void {
  board.gameMessage = message;
  if (message && isHeadlessRun()) recordSimLog(message);
}
