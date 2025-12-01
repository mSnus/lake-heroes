import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function endTurn(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));

  const nextPlayer = board.activePlayer;
  if (nextPlayer.turnsToSkip > 0) {
    say(`${nextPlayer.name} should skip the turn`, 'info');
    setMenu({ type: 'end-turn' });
  }

  setMenu({ type: 'main' });
  board.turns += 1;
}
