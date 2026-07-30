import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { REVEAL_GOLD_PER_CIRCLE } from '../game/constants';
import { t } from '../i18n';

export function revealTile(board: GameState): void {
  const reward = REVEAL_GOLD_PER_CIRCLE * ((board.activePlayer.circles ?? 0) + 1);
  board.activePlayer.gold += reward;
  say(
    t('revealTile.discovered', { playerName: board.activePlayer.name, tileName: board.activeTile.name, reward }),
    'success'
  );
}
