import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

export function handleRogueCamp(
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  say(`${player.name} recruited units! Rolled ${roll}, received ${unitsReward} U!`, 'success');
  endTurn();
}

