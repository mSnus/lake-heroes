import { GameState } from '../game/GameState';
import { KNIGHT_FAME } from '../game/constants';
import { showKnightPromotionScreen } from '../utils/screenStore';
import { recordStatEvent } from '../game/statistics';

/**
 * Fame alone no longer makes a player a Knight — that only happens the next
 * time they cross the King's Castle tile (position 0) with fame already at
 * or above KNIGHT_FAME. Checked alongside the other pre-movement encounters
 * so it can show (and pause movement) before the King's Castle screen itself,
 * on a turn that lands exactly there.
 */
export function checkKnightPromotion(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  willCrossStart: boolean
): boolean {
  const player = board.activePlayer;
  if (!willCrossStart) return false;
  if (player.isKnight || player.fame < KNIGHT_FAME) return false;

  player.isKnight = true;
  recordStatEvent(board, player, 'promotion');
  updateGameState(board);

  showKnightPromotionScreen(player.name, player.color, onContinue);
  return true;
}
