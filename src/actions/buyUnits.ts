import { GameState } from '../game/GameState';
import { say, sayLocal } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { unitCost, scaleCost, canPay, pay, formatCost } from '../game/resources';
import { UnitTier } from '../game/army';
import { formatArmy } from '../utils/formatArmy';
import { t } from '../i18n';

export function buyUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void,
  tier: UnitTier = 'militia',
  // Overrides the gold part of the price -- the Tavern charges a premium
  // over the King's Castle's own (see tavern.ts).
  priceOverride?: number
) {
  if (!board) return;

  const player = board.activePlayer;
  const unit = unitCost(tier, priceOverride);

  if (canPay(player, scaleCost(unit, amount))) {
    const gained = tier === 'riders' ? player.gainRiders(amount) : player.gainMilitia(amount);
    const paid = scaleCost(unit, gained);
    pay(player, paid);
    const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
    say(
      t('buyUnits.bought', {
        playerName: player.name,
        amount: gained,
        tier: tierLabel,
        cost: formatCost(paid),
        army: formatArmy(player.militia, player.riders),
      }),
      'success'
    );
    updateGameState(board);
  } else {
    sayLocal(t('buyUnits.notEnoughGold'), 'error');
  }

  setEndTurn();
}
