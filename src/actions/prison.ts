import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { toast } from 'react-toastify';

export function handlePrison(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const player = board.activePlayer;
  player.turnsToSkip = 1;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  toast.warning(`${player.name} landed on Prison! Next turn will be skipped.`);
  setMenu({ type: 'move-result', diceRoll: 0, passedStart: false });
}

