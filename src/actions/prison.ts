import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function handlePrison(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  const player = board.activePlayerIndex;
  board.players[player].turnsToSkip = 1;

  console.log('Action: prison for', board.players[player].name);

  updateGameState(board);
  say(`${board.players[player].name} landed on Prison! Next turn will be skipped.`, 'warning');

  setMenu({ type: 'move-result' });
}
