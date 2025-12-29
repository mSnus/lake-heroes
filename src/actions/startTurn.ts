import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { gameEvent } from '../utils/events';
import { showModal } from '../utils/modalStore';
import { say } from '../utils/say';

export function startTurn(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  say(`${board.activePlayer.name}'s turn`, 'info');
  showModal('dice');
}
