import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { RIDER_UNIT_PRICE, UNIT_PRICE } from '../game/constants';
import { UnitTier } from '../game/army';

export function buyUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void,
  tier: UnitTier = 'militia'
) {
  if (!board) return;

  const player = board.activePlayer;
  const unitPrice = tier === 'riders' ? RIDER_UNIT_PRICE : UNIT_PRICE;
  const cost = amount * unitPrice;

  if (player.gold >= cost) {
    const gained = tier === 'riders' ? player.gainRiders(amount) : player.gainMilitia(amount);
    player.gold -= gained * unitPrice;
    player.unitsHiredThisTurn += gained;
    say(`${player.name} bought ${gained} ${tier} for ${gained * unitPrice}🟡.`, 'success');
    updateGameState(board);
  } else {
    say('Not enough gold to buy units.', 'error');
  }

  setEndTurn();
}
