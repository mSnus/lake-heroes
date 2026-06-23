import { GameState } from '../game/GameState';
import { showPrisonScreen } from '../utils/screenStore';
import { hasArtifact, getArtifact } from '../game/artifacts';

export function handlePrison(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const playerIdx = board.activePlayerIndex;
  const player = board.players[board.playerOrder[playerIdx]];

  console.log('Action: prison for', player.name);

  let message = board.gameMessage;
  if (hasArtifact(player, 'medal-of-honor')) {
    const artifact = getArtifact('medal-of-honor');
    message = `${player.name} is sent to Prison, but the ${artifact!.name} ${artifact!.emoji} keeps them free — no turn skipped!`;
    board.gameMessage = message;
  } else {
    player.turnsToSkip = 1;
  }

  updateGameState(board);

  showPrisonScreen(message, board.activeTile.name);
}
