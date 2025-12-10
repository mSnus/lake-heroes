import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle for', board.activePlayer);

  setMenu({ type: 'buy-units' });
}
