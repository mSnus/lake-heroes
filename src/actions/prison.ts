import { GameState } from '../game/GameState';
import { showPrisonScreen } from '../utils/screenStore';
import { getPrisonProtectionArtifact } from '../game/artifacts';
import { setGameMessage } from '../utils/gameMessage';
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
  const artifact = getPrisonProtectionArtifact(player);
  if (artifact) {
    message = t('prison.savedByArtifact', { artifactName: artifact.name, emoji: artifact.emoji });
    setGameMessage(board, message);
  } else {
    player.turnsToSkip = 1;
  }

  updateGameState(board);

  showPrisonScreen(message);
}
