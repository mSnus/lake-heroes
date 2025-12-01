import { Board } from '../Board';
import { say } from '../../utils/say';

export function gameStart(board: Board): void {
  if (board.gameStarted) return;

  board.players.forEach((player) => {
    player.gold = 500;
    player.units = 12;
  });

  board.turns = 0;
  board.gameStarted = true;

  say('New game started! Good luck to all players!', 'success');
}
