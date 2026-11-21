import { GameState } from '../game/GameState';
import { showPrisonScreen } from '../utils/screenStore';
import { getPrisonProtectionArtifact, Artifact } from '../game/artifacts';
import { Player } from '../game/Player';
import { setGameMessage } from '../utils/gameMessage';
import { t } from '../i18n';
import { resetKarma } from '../utils/karma';

/** Puts `player` in Prison with its usual effects: karma back to 0 and a
 * skipped turn, unless a medal spares it (returned, if so). */
export function imprison(board: GameState, player: Player): Artifact | undefined {
  const prisonIdx = board.tiles.findIndex((t) => t?.id === 'prison');
  if (prisonIdx >= 0) player.position = prisonIdx;
  resetKarma(player);
  const artifact = getPrisonProtectionArtifact(player);
  if (!artifact) player.turnsToSkip = 1;
  return artifact;
}

export function handlePrison(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const playerIdx = board.activePlayerIndex;
  const player = board.players[board.playerOrder[playerIdx]];

  console.log('Action: prison for', player.name);

  // Not board.gameMessage — that may still hold an unrelated earlier event's
  // text from the same turn (e.g. an ambush resolved during this move), which
  // would otherwise show up glued below the standard prison flavor text.
  let message = '';
  const artifact = imprison(board, player);
  if (artifact) {
    message = t('prison.savedByArtifact', { artifactName: artifact.name, emoji: artifact.emoji });
    setGameMessage(board, message);
  }

  updateGameState(board);

  showPrisonScreen(message);
}
