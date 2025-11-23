import { Board } from '../game/Board';
import { say } from '../utils/say';

export function passStart(board: Board | null, setBoard: (board: Board) => void) {
  if (!board) return;
  const player = board.activePlayer;
  player.gold += 500;
  player.units += 5;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  say(`${player.name} passed start: +500 GP, +5 U`, 'success');
}



