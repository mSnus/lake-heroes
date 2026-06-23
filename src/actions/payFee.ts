import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { say } from '../utils/say';
import { clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { getEffectiveFee } from './feeOptions';

export function payFee(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;
  const tile = board.activeTile;
  const player = board.activePlayer;
  const owner = board.players.find((p: Player) => p.id === tile.owner);

  const fee = getEffectiveFee(tile, player);

  if (player.gold >= fee && owner) {
    player.gold -= fee;

    let msg: string;
    if (owner.turnsToSkip > 0) {
      msg = `${player.name} paid ${fee}🟡 for ${tile.name}, but ${owner.name} is in prison and collects nothing.`;
    } else {
      owner.gold += fee;
      msg = `${player.name} paid ${fee}🟡 to ${owner.name} for ${tile.name}.`;
    }

    // Set the banner too, otherwise it lingers on a stale (e.g. battle) message.
    say(msg, 'info');
    board.gameMessage = msg;

    updateGameState(board);
  }

  clearScreen();
  setEndTurn();
}
