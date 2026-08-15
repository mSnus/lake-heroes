import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { say } from '../utils/say';
import { clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { getEffectiveFee } from './feeOptions';
import { t } from '../i18n';

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
      msg = t('payFee.paidButOwnerInPrison', {
        playerName: player.name,
        fee,
        tileName: tile.name,
        ownerName: owner.name,
      });
    } else {
      owner.gold += fee;
      msg = t('payFee.paid', {
        playerName: player.name,
        fee,
        ownerName: owner.name,
        tileName: tile.name,
      });
    }

    // Set the banner too, otherwise it lingers on a stale (e.g. battle) message.
    say(msg, 'info');
    board.gameMessage = msg;

    updateGameState(board);
  }

  player.hasResolvedTileEncounterThisTurn = true;
  clearScreen();
  setEndTurn();
}
