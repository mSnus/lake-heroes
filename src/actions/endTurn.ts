import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function endTurn(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const currentPlayer = board.activePlayer;

  // Check if current player should skip turn
  if (currentPlayer.turnsToSkip > 0) {
    currentPlayer.turnsToSkip--;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    say(`Turn of ${currentPlayer.name} is skipped`, 'warning');
    // Move to next player
    board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    // Announce next player's turn (not skipped)
    const nextPlayer = board.activePlayer;
    if (nextPlayer.turnsToSkip <= 0) {
      say(`${nextPlayer.name}'s turn`, 'info');
    }
    setMenu({ type: 'main' });
    return;
  }

  // Normal turn end
  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  // Announce new active player's turn
  const nextPlayer = board.activePlayer;
  if (nextPlayer.turnsToSkip <= 0) {
    say(`${nextPlayer.name}'s turn`, 'info');
  }
  setMenu({ type: 'main' });
}

