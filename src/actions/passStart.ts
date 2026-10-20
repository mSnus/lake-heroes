import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { recordStatEvent } from '../game/statistics';
import { isHeadlessRun } from '../utils/headlessStore';
import { recordSimCircleSnapshot } from '../utils/simLogStore';
import { formatPlayerCell } from '../utils/formatPlayerCell';
import { t } from '../i18n';

/**
 * Lap tracking only -- crossing King's Castle no longer pays out anything
 * by itself. The Yearly Bonus moved to the shared calendar year ending
 * (game/year.ts's startNewYear, for every player at once), and landing
 * directly on the Castle grants King's Grace instead (actions/king.tsx).
 * Passing through mid-roll still counts the same as landing for lap
 * purposes -- it just doesn't carry a reward either way anymore.
 */
export function passStart(
  board: GameState | null,
  updateGameState: (board: GameState) => void
): void {
  if (!board) return;

  const player = board.activePlayer;

  player.circles = (player.circles ?? 0) + 1;
  // Surviving the first lap is itself worth a point of fame.
  if (player.circles === 1) changeFame(player, 1);
  recordStatEvent(board, player, 'kings-castle');
  console.log('Action: pass start for', player.name);

  say(
    t('passStart.spentYearsWandering', { playerName: player.name, circles: player.circles }),
    'debug'
  );

  // This crossing is simultaneously "circle player.circles begins" and
  // "circle player.circles - 1 ends" -- one snapshot serves both (see
  // recordSimCircleSnapshot).
  if (isHeadlessRun()) {
    recordSimCircleSnapshot(player.id, player.circles, formatPlayerCell(board, player));
  }

  updateGameState(board);
}
