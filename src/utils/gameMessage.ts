import { GameState } from '../game/GameState';
import { isHeadlessRun } from './headlessStore';
import { recordSimLog } from './simLogStore';
import { gameEvent } from './events';

/** Sets the banner message shown under the board, and mirrors it into the
 * per-circle sim log during a headless run -- same treatment say() already
 * gives toasts, so important game-message-only events aren't invisible to
 * the economy simulator's results table. */
export function setGameMessage(board: GameState, message: string): void {
  board.gameMessage = message;
  if (message && isHeadlessRun()) recordSimLog(message);

  // Mirrored to the other players while the turn is still running (see
  // online/stream.ts), the same way say() emits 'logMessage'. An event rather
  // than a direct call so utils/ never has to import online/.
  //
  // Empty messages are skipped deliberately: rollAndMove blanks the banner on
  // every single move, and broadcasting that would just wipe whatever the
  // observers were reading.
  if (message) gameEvent('bannerMessage', message);
}
