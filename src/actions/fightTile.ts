import { GameState } from '../game/GameState';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { Player } from '../game/Player';

export function fightTile(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const attacker = board.activePlayer;
  const tile = board.activeTile;

  // A banzai attack is always on the table with any nonzero army.
  if (attacker.armyPower <= 0) return;

  const defender = board.players.find((p: Player) => p.id === tile.owner);
  if (!defender) return;

  showBattleScreen(
    { attacker, defender, tile, gameState: board, updateGameState },
    { screenType: 'tile-battle' }
  );
}
