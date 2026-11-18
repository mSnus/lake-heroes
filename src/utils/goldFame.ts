import { Player } from '../game/Player';
import { GOLD_FAME_FIRST, GOLD_FAME_STEP } from '../game/constants';
import { changeFame } from './fame';
import { say } from './say';
import { t } from '../i18n';

/** +1 fame for each gold milestone (1000, 1500, 2000...) reached for the first time. */
export function checkGoldFame(player: Player): void {
  let next = player.nextGoldMilestone ?? GOLD_FAME_FIRST;
  let reached = 0;
  while (player.gold >= next) {
    reached++;
    next += GOLD_FAME_STEP;
  }

  if (!reached) return;
  player.nextGoldMilestone = next;
  changeFame(player, reached);
  say(t('goldFame.reached', { playerName: player.name, gold: next - GOLD_FAME_STEP, fame: reached }), 'info');
}
