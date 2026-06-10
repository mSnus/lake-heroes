import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { say } from '../utils/say';
import { clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

export function payFee(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;
  const tile = board.activeTile;
  const player = board.activePlayer;
  const owner = board.players.find((p: Player) => p.id === tile.owner);

  const fee = tile.fee;

  if (player.gold >= fee && owner) {
    player.gold -= fee;
    if (owner.turnsToSkip > 0) {
      say(
        `${player.name} paid ${fee}🟡 for ${tile.name}, but ${owner.name} is in prison and collects nothing.`,
        'info'
      );
    } else {
      owner.gold += fee;
      say(`${player.name} paid ${fee}🟡 to ${owner.name} for ${tile.name}.`, 'info');
    }

    updateGameState(board);
  }

  clearScreen();
  setEndTurn();
}
