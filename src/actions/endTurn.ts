import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';

export function endTurn(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  console.log('Action: end turn for', board.activePlayer.name);

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  board.gameMessage = '';

  if (board.activePlayer.turnsToSkip > 0) {
    board.activePlayer.turnsToSkip--;
    board.gameMessage = `The prison is wet and cold, ${board.activePlayer.name}`;
    say(`${board.activePlayer.name} dwells in prison and skips the turn`, 'info');
    setMenu({ type: 'end-turn' });
    gameEvent('hideDice', true);
  } else {
    setMenu({ type: 'main' });
    gameEvent('needDiceRoll', true);
  }

  updateGameState(board);
}
