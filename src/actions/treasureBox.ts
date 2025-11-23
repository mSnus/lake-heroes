import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

export function handleTreasureBox(
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const goldReward = roll * 100;
  const player = board.activePlayer;
  player.gold += goldReward;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  say(`${player.name} found treasure! Rolled ${roll}, received ${goldReward} GP!`, 'success');
  endTurn();
}

