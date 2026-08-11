import { GameState } from '../game/GameState';
import { showPrisonScreen } from '../utils/screenStore';
import { hasArtifact, getArtifact } from '../game/artifacts';
import { t } from '../i18n';

export function handlePrison(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const playerIdx = board.activePlayerIndex;
  const player = board.players[board.playerOrder[playerIdx]];

  console.log('Action: prison for', player.name);

  // Not board.gameMessage — that may still hold an unrelated earlier event's
  // text from the same turn (e.g. an ambush resolved during this move), which
  // would otherwise show up glued below the standard prison flavor text.
  let message = '';
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
