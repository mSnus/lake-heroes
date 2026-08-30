import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { computeAnnualReward } from '../game/kingsGrace';
import { recordStatEvent } from '../game/statistics';
import { isHeadlessRun } from '../utils/headlessStore';
import { recordSimCircleSnapshot } from '../utils/simLogStore';
import { formatPlayerCell } from '../utils/formatPlayerCell';
import { t } from '../i18n';

/**
 * @param isLanding Whether this player's move actually ENDS on King's
 * Castle, rather than just wrapping past it partway through a longer roll.
 * Gold still pays out on every pass, same as always; every King's Grace
 * unit reward (tile trickle, catch-up support, and the direct per-fame
 * grant) requires landing exactly on the tile.
 */
export function passStart(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  isLanding: boolean
): string {
  if (!board) return '';

  const player = board.activePlayer;
  const { totalGold, tileUnits, kingsMilitia, kingsRiders } = computeAnnualReward(board, player);
  const militiaGranted = isLanding ? tileUnits + kingsMilitia : 0;
  const ridersGranted = isLanding ? kingsRiders : 0;
  const unitsGranted = militiaGranted + ridersGranted;

  player.circles = (player.circles ?? 0) + 1;
  // Surviving the first lap is itself worth a point of fame.
  if (player.circles === 1) changeFame(player, 1);
  player.dragonEncounters = 0;
  player.caravanEncounters = 0;
  player.ambushEncounters = 0;
  recordStatEvent(board, player, 'kings-castle');
  console.log('Action: pass start for', player.name);

  say(
    t('passStart.spentYearsWandering', { playerName: player.name, circles: player.circles }),
    'debug'
  );

  // Apply rewards
  player.gold += totalGold;
  player.units += militiaGranted;
  player.gainRiders(ridersGranted);

  // Build toast message summarizing rewards
  const parts: string[] = [];

  if (totalGold > 0) parts.push(`${totalGold}🟡`);
  if (unitsGranted > 0) parts.push(`${unitsGranted}👬`);

  const summary = parts.join(` ${t('common.and')} `);

  say(t('passStart.receives', { playerName: player.name, summary }), 'success');

  const years =
    player.circles < 3 ? t('passStart.aYear') : t('passStart.years', { count: player.circles - 1 });
  const rewardMessage = t('passStart.kingRewardsYou', { years });
  board.kingRewardMessage = rewardMessage;

  // This crossing is simultaneously "circle player.circles begins" and
  // "circle player.circles - 1 ends" -- one snapshot serves both (see
  // recordSimCircleSnapshot).
  if (isHeadlessRun()) {
    recordSimCircleSnapshot(player.id, player.circles, formatPlayerCell(board, player));
  }

  updateGameState(board);
  return rewardMessage;
}
