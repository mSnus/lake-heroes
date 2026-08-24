import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { MONEY_START, UNITS_START } from '../components/board/common';
import { gameEvent } from '../utils/events';
import { setGameMessage } from '../utils/gameMessage';
import { t } from '../i18n';

export function gameStart(
  gameState: GameState | null,
  updateGameState: (board: GameState) => void
): void {
  if (!gameState || gameState.gameStarted) return;

  console.log('Action: game start');

  gameState.players.forEach((player: Player) => {
    player.gold = MONEY_START;
    player.units = UNITS_START;
  });

  gameState.turns = 0;
  gameState.gameStarted = true;
  setGameMessage(gameState, t('gameStart.message'));

  updateGameState(gameState);

  gameEvent('displayTile', {});
}
