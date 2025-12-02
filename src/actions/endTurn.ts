import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function endTurn(
  board: GameState | null,
  setGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  console.log('Action: end turn');

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));

  const nextPlayer = board.activePlayer;
  if (nextPlayer.turnsToSkip > 0) {
    nextPlayer.turnsToSkip--;
    say(`${nextPlayer.name} dwells in prison and skips the turn`, 'info');
    setMenu({ type: 'end-turn' });
  }

  window.dispatchEvent(new CustomEvent('tileClicked', {}));
  setMenu({ type: 'main' });
  board.turns += 1;
}
