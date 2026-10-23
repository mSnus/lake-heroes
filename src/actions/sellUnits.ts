import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { unitCost, scaleCost, refund, formatCost } from '../game/resources';
import { UnitTier } from '../game/army';
import { t } from '../i18n';

/** Disbands `amount` units of a tier for a full refund of their recipe
 * (gold, food and arms) — the "✖️" sell action next to an army tier. */
export function sellUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void,
  tier: UnitTier = 'militia'
) {
  if (!board || amount <= 0) return;

  const player = board.activePlayer;
  const sold = Math.min(amount, tier === 'riders' ? player.riders : player.militia);

  if (tier === 'riders') {
    player.riders -= sold;
  } else {
    player.militia -= sold;
  }

  const refunded = scaleCost(unitCost(tier), sold);
  refund(player, refunded);

  const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
  say(t('sellUnits.sold', { playerName: player.name, amount: sold, tier: tierLabel, cost: formatCost(refunded) }), 'info');
  updateGameState(board);
}
