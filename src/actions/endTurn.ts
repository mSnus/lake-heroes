import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';

export function endTurn(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  setMenu({ type: 'main' });
}

