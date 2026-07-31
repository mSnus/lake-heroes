import { GameState } from '../game/GameState';
import { showPrisonScreen } from '../utils/screenStore';
import { hasArtifact, getArtifact } from '../game/artifacts';
import { t } from '../i18n';

export function handlePrison(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const playerIdx = board.activePlayerIndex;
  const player = board.players[board.playerOrder[playerIdx]];

  console.log('Action: prison for', player.name);

  let message = board.gameMessage;
  if (hasArtifact(player, 'medal-of-honor')) {
    const artifact = getArtifact('medal-of-honor');
    message = t('prison.savedByArtifact', { playerName: player.name, artifactName: artifact!.name, emoji: artifact!.emoji });
    board.gameMessage = message;
  } else {
    player.turnsToSkip = 1;
  }

  updateGameState(board);

  showPrisonScreen(message);
}
