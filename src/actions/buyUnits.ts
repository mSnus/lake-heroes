import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { getOverrides } from '../utils/overridesStore';
import { UnitTier } from '../game/army';
import { t } from '../i18n';

export function buyUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void,
  tier: UnitTier = 'militia'
) {
  if (!board) return;

  const player = board.activePlayer;
  const ov = getOverrides();
  const unitPrice = tier === 'riders' ? ov.riderPrice : ov.militiaPrice;
  const cost = amount * unitPrice;

  if (player.gold >= cost) {
    const gained = tier === 'riders' ? player.gainRiders(amount) : player.gainMilitia(amount);
    player.gold -= gained * unitPrice;
    const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
    say(t('buyUnits.bought', { playerName: player.name, amount: gained, tier: tierLabel, gold: gained * unitPrice }), 'success');
    updateGameState(board);
  } else {
    say(t('buyUnits.notEnoughGold'), 'error');
  }

  setEndTurn();
}
