import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';

export function handlePrison(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  const player = board.activePlayerIndex;
  board.players[board.playerOrder[player]].turnsToSkip = 1;

  console.log('Action: prison for', board.players[board.playerOrder[player]].name);

  updateGameState(board);

  setMenu({ type: 'prison-regular' });
}
