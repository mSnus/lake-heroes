import { GameState } from '../game/GameState';
import { showBattleScreen } from '../game/battleGrid/battleResolution';

export function claimTile(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const attacker = board.activePlayer;
  const tile = board.activeTile;

  if (tile.isOwned()) return;
  if (!tile.isAffordable(attacker.gold, attacker.armyPower, attacker.fame, board.round)) return;
  if (attacker.hasClaimedThisTurn) return;

  attacker.hasClaimedThisTurn = true;

  showBattleScreen(
    { attacker, tile, gameState: board, updateGameState },
    { screenType: 'tile-battle' }
  );
}
