import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { REVEAL_GOLD_PER_CIRCLE } from '../game/constants';

export function revealTile(board: GameState): void {
  const reward = REVEAL_GOLD_PER_CIRCLE * ((board.activePlayer.circles ?? 0) + 1);
  board.activePlayer.gold += reward;
  say(
    `${board.activePlayer.name} discovered ${board.activeTile.name}. Reward: ${reward}`,
    'success'
  );
}
