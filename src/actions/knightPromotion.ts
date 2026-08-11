import { GameState } from '../game/GameState';
import { KNIGHT_FAME } from '../game/constants';
import { showKnightPromotionScreen } from '../utils/screenStore';
import { recordStatEvent } from '../game/statistics';

/**
 * Fame alone no longer makes a player a Knight — that only happens the next
 * time they cross the King's Castle tile (position 0) with fame already at
 * or above KNIGHT_FAME. Checked after the move itself has finished (token
 * already landed) but before the landed tile's own screen — most
 * importantly the King's Castle screen, on a turn that lands exactly there —
 * so promotion never interrupts the move animation, only what happens once
 * the player has actually arrived.
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
