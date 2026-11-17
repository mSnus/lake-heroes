import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { recordStatEvent } from '../game/statistics';
import { isHeadlessRun } from '../utils/headlessStore';
import { recordSimCircleSnapshot } from '../utils/simLogStore';
import { formatPlayerCell } from '../utils/formatPlayerCell';
import { t } from '../i18n';
import { grantKingsGrace } from '../game/kingsGrace';

/** Crossing or landing on King's Castle: a new lap, and the King's Grace. */
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

  const grace = grantKingsGrace(board, player);
  const units = grace.militia + grace.riders;
  if (grace.gold > 0 || units > 0) {
    const parts: string[] = [];
    if (grace.gold > 0) parts.push(`${grace.gold}🟡`);
    if (units > 0) parts.push(`${units}👬`);
    say(t('king.kingsGraceReceived', { playerName: player.name, summary: parts.join(` ${t('common.and')} `) }), 'info');
  }

  // This crossing is simultaneously "circle player.circles begins" and
  // "circle player.circles - 1 ends" -- one snapshot serves both (see
  // recordSimCircleSnapshot).
  if (isHeadlessRun()) {
    recordSimCircleSnapshot(player.id, player.circles, formatPlayerCell(board, player));
  }

  updateGameState(board);
}
