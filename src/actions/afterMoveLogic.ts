import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function afterMoveLogic(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  const player = board.activePlayer;
  const tileIdx = player.position;
  const tile = board.tiles[tileIdx];

  console.log(`Action: after move logic for ${player.name} on ${tile.name}`, player, tile);

  // Special tiles are already handled in rollAndMove, so just end turn if it's a special tile
  if (!tile.isOwnable) {
    setMenu({ type: 'end-turn' });
    return;
  }

  // Ownable, not owned, player can buy
  if (!tile.isOwned()) {
    if (
      player.gold >= tile.prices['1']?.gold ??
      (0 && player.units >= tile.prices['1']?.units) ??
      0
    ) {
      setMenu({ type: 'buy' });
      return;
    } else {
      say(`${player.name} cannot afford to buy ${tile.name}.`, 'warning');
      setMenu({ type: 'end-turn' });
      return;
    }
  }

  // Ownable, owned by someone else
  if (tile.isOwned() && tile.owner !== player.name) {
    const fee = tile.defences[tile.level ?? 1] * 10 || 0;
    const defence = tile.defences[tile.level ?? 1] || 0;

    if (player.gold < fee && player.units < defence) {
      //Death
      say(
        `${player.name} cannot afford to pay the fee or fight the defences on ${tile.name}.`,
        'error'
      );
      board.gameMessage = `${player.name} is technically dead.`;
      updateGameState(board);
      setMenu({ type: 'end-turn' });
    } else {
      setMenu({ type: 'fee-or-fight' });
      return;
    }
  }

  // Else, just end turn
  setMenu({ type: 'end-turn' });
}
