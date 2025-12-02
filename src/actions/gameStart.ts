import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { MONEY_START, UNITS_START } from '../components/board/common';

export function gameStart(board: GameState): void {
  if (board.gameStarted) return;

  console.log('Action: game start');

  board.players.forEach((player: Player) => {
    player.gold = MONEY_START;
    player.units = UNITS_START;
  });

  board.turns = 0;
  board.gameStarted = true;

  say('New game started! Good luck to all players!', 'success');
}
