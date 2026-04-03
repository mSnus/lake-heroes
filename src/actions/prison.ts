import { GameState } from '../game/GameState';
import { showPrisonScreen } from '../utils/screenStore';

export function handlePrison(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  const player = board.activePlayerIndex;
  board.players[board.playerOrder[player]].turnsToSkip = 1;

  const playerName = board.players[board.playerOrder[player]].name;
  console.log('Action: prison for', playerName);

  board.gameMessage = `${playerName} dwells in prison`;
  updateGameState(board);

  showPrisonScreen(board.gameMessage, board.activeTile.name);
}
