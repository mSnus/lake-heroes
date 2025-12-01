import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

export function handleKingCastle(
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  say(`King provides ${player.name} with ${unitsReward}🧍!`, 'success');
  endTurn();
}
