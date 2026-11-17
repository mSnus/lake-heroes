import { GameState } from '../game/GameState';
import { sayInTopic } from '../utils/say';
import { REVEAL_GOLD_PER_YEAR } from '../game/constants';
import { currentYear } from '../game/year';
import { t } from '../i18n';

export function revealTile(board: GameState): void {
  const reward = REVEAL_GOLD_PER_YEAR * currentYear(board);
  board.activePlayer.gold += reward;
  const player = board.activePlayer;
  const tileName = board.activeTile.name;
  sayInTopic(
    t('topics.discovered', { reward }),
    t('revealTile.discovered', { playerName: player.name, tileName, reward }),
    'success',
    { actor: player.name, subject: tileName }
  );
}
