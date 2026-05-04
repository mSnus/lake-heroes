import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { REVEAL_GOLD } from '../game/constants';

export function revealTile(board: GameState): void {
  board.activePlayer.gold += REVEAL_GOLD;
  say(`${board.activePlayer.name} discovered ${board.activeTile.name}. Reward: ${REVEAL_GOLD}`, 'success');
}
