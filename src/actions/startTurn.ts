import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function startTurn(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  say(`${board.activePlayer.name}'s turn`, 'info');

  setMenu({ type: 'main' });
}
