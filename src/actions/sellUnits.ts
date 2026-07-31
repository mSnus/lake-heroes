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
  const sold = Math.min(amount, tier === 'riders' ? player.riders : player.militia);

  if (tier === 'riders') {
    player.riders -= sold;
  } else {
    player.militia -= sold;
  }
  player.gold += sold * unitPrice;
  // Selling gives back this visit's hiring allowance for the units sold, so
  // hitting the fame-based cap doesn't strand you once you've sold some back.
  player.unitsHiredThisTurn = Math.max(0, player.unitsHiredThisTurn - sold);

  const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
  say(t('sellUnits.sold', { playerName: player.name, amount, tier: tierLabel, gold: amount * unitPrice }), 'info');
  updateGameState(board);
}
