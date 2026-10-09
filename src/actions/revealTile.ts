import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { REVEAL_GOLD_PER_YEAR } from '../game/constants';
import { currentYear } from '../game/year';
import { t } from '../i18n';

export function revealTile(board: GameState): void {
  const reward = REVEAL_GOLD_PER_YEAR * currentYear(board);
  board.activePlayer.gold += reward;
  say(
    t('revealTile.discovered', { playerName: board.activePlayer.name, tileName: board.activeTile.name, reward }),
    'success'
  );
}
