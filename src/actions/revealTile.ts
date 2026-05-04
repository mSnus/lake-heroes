import { GameState } from '../game/GameState';
import { say } from '../utils/say';

export const REVEAL_GOLD = 100;

export function revealTile(board: GameState): void {
  board.activePlayer.gold += REVEAL_GOLD;
  say(`${board.activePlayer.name} explored new lands! +${REVEAL_GOLD} gold`, 'success');
}
