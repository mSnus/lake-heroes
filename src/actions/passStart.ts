import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { computeKingsGraceReward } from '../game/kingsGrace';
import { t } from '../i18n';

export function passStart(board: GameState | null, updateGameState: (board: GameState) => void): string {
  if (!board) return '';

  const player = board.activePlayer;
  const { totalGold, totalUnits } = computeKingsGraceReward(board, player);

  player.circles = (player.circles ?? 0) + 1;
  player.dragonEncounters = 0;
  player.caravanEncounters = 0;
  console.log('Action: pass start for', player.name);

  say(t('passStart.spentYearsWandering', { playerName: player.name, circles: player.circles }), 'debug');

  // Apply rewards
  player.gold += totalGold;
  player.units += totalUnits;

  // Build toast message summarizing rewards
  const parts: string[] = [];

  if (totalGold > 0) parts.push(`${totalGold}🟡`);
  if (totalUnits > 0) parts.push(`${totalUnits}🧍`);

  const summary = parts.join(` ${t('common.and')} `);

  say(t('passStart.receives', { playerName: player.name, summary }), 'success');

  const years = player.circles < 3 ? t('passStart.aYear') : t('passStart.years', { count: player.circles - 1 });
  const rewardMessage = t('passStart.kingRewardsYou', { years });
  board.kingRewardMessage = rewardMessage;

  updateGameState(board);
  return rewardMessage;
}
