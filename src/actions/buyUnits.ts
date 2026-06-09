import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { UNIT_PRICE } from '../game/constants';

export function buyUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  const player = board.activePlayer;
  const cost = amount * UNIT_PRICE;

  if (player.gold >= cost) {
    player.gold -= cost;
    player.units += amount;
    player.unitsHiredThisTurn += amount;
    say(`${player.name} bought ${amount} units for ${cost}🟡.`, 'success');
    updateGameState(board);
  } else {
    say('Not enough gold to buy units.', 'error');
  }

  setEndTurn();
}
