import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { RIDER_UNIT_PRICE, UNIT_PRICE } from '../game/constants';
import { UnitTier } from '../game/army';
import { t } from '../i18n';

/** Disbands a squad for a full refund of its recruit price — the King's
 * Castle "✖️" sell button next to a squad. */
export function sellUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void,
  tier: UnitTier = 'militia'
) {
  if (!board || amount <= 0) return;

  const player = board.activePlayer;
  const unitPrice = tier === 'riders' ? RIDER_UNIT_PRICE : UNIT_PRICE;

  if (tier === 'riders') {
    const sold = Math.min(amount, player.riders);
    player.riders -= sold;
    player.gold += sold * unitPrice;
  } else {
    const sold = Math.min(amount, player.militia);
    player.militia -= sold;
    player.gold += sold * unitPrice;
  }

  const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
  say(t('sellUnits.sold', { playerName: player.name, amount, tier: tierLabel, gold: amount * unitPrice }), 'info');
  updateGameState(board);
}
