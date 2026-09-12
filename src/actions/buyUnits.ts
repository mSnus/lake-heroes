import { GameState } from '../game/GameState';
import { say, sayLocal } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { getOverrides } from '../utils/overridesStore';
import { UnitTier } from '../game/army';
import { formatArmy } from '../utils/formatArmy';
import { t } from '../i18n';

export function buyUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void,
  tier: UnitTier = 'militia',
  // Overrides the normal per-tier price -- the Tavern charges a premium
  // over the King's Castle's own militia price (see tavern.ts).
  priceOverride?: number
) {
  if (!board) return;

  const player = board.activePlayer;
  const ov = getOverrides();
  const unitPrice = priceOverride ?? (tier === 'riders' ? ov.riderPrice : ov.militiaPrice);
  const cost = amount * unitPrice;

  if (player.gold >= cost) {
    const gained = tier === 'riders' ? player.gainRiders(amount) : player.gainMilitia(amount);
    player.gold -= gained * unitPrice;
    const tierLabel = t(tier === 'riders' ? 'common.tierRiders' : 'common.tierMilitia');
    say(
      t('buyUnits.bought', {
        playerName: player.name,
        amount: gained,
        tier: tierLabel,
        gold: gained * unitPrice,
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
