import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function endTurn(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  board.turns += 1;
  board.gameMessage = '';
  console.log('Action: end turn for', board.activePlayer.name);

  if (board.activePlayer.turnsToSkip > 0) {
    board.activePlayer.turnsToSkip--;

    say(`${board.activePlayer.name} dwells in prison and skips the turn`, 'info');
    setMenu({ type: 'end-turn' });
  } else {
    setMenu({ type: 'main' });
  }

  updateGameState(board);

  window.dispatchEvent(new CustomEvent('setViewedTitle', {}));
}
