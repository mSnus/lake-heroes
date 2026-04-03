import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { MONEY_START, UNITS_START } from '../components/board/common';
import { gameEvent } from '../utils/events';

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
  gameState.gameMessage = 'New game started! Good luck to all players.';

  updateGameState(gameState);

  gameEvent('displayTile', {});
}
