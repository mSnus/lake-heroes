import { GameState } from '../game/GameState';
import { changeFame } from '../utils/fame';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { showTileClaimScreen } from './showTileClaimScreen';
import { t } from '../i18n';

/**
 * A rival's tile with an empty garrison (defence 0) needs no fight — the
 * active player just walks in and takes it. Skips the battle screen
 * entirely: ownership transfers straight to the attacker (free, no gold
 * cost — this is a takeover, not a purchase), the tile resets to level 1
 * with an empty garrison like any fresh claim, and the same "tile was
 * claimed" screen shown after a real claim battle follows.
 */
export function claimUndefendedTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  const attacker = board.activePlayer;
  const tile = board.activeTile;
  if (!tile.isOwned() || tile.garrison > 0) return;

  const defender = board.players.find((p) => p.id === tile.owner);

  board.players.forEach((p) => {
    p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
  });

  tile.owner = attacker.id;
  tile._level = 1;
  tile.isYielded = false;
  tile.garrisonMilitia = 0;
  tile.garrisonRiders = 0;
  attacker.ownedTiles.push(attacker.position);

  changeFame(attacker, 1);
  if (defender) changeFame(defender, -1);

  board.gameMessage = t('claimUndefendedTile.findsDefenceless', { attackerName: attacker.name, tileName: tile.name });
  say(t('claimUndefendedTile.claimsWithoutFight', { attackerName: attacker.name, tileName: tile.name }), 'success');

  setEndTurn();
  updateGameState(board);

  showTileClaimScreen({ tile, player: attacker, gameState: board, updateGameState });
}
