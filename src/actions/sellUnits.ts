import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { getOverrides } from '../utils/overridesStore';
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
  const ov = getOverrides();
  const unitPrice = tier === 'riders' ? ov.riderPrice : ov.militiaPrice;
  const sold = Math.min(amount, tier === 'riders' ? player.riders : player.militia);

  if (tier === 'riders') {
    player.riders -= sold;
  } else {
    player.militia -= sold;
  }
  player.gold += sold * unitPrice;

  const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
  say(t('sellUnits.sold', { playerName: player.name, amount, tier: tierLabel, gold: amount * unitPrice }), 'info');
  updateGameState(board);
}
