import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';

const UNIT_COST = 100;

export function buyUnits(
  board: GameState | null,
  amount: number,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  const player = board.activePlayer;
  const cost = amount * UNIT_COST;

  if (player.gold >= cost) {
    player.gold -= cost;
    player.units += amount;
    say(`${player.name} bought ${amount} units for ${cost}🟡.`, 'success');
    updateGameState(board);
  } else {
    say('Not enough gold to buy units.', 'error');
  }

  setEndTurn();
}
