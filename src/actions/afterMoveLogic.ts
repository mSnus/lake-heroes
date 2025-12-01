import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function afterMoveLogic(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void,
  endTurn: () => void
) {
  if (!board) return;
  const player = board.activePlayer;
  const tileIdx = player.position;
  const tile = board.tiles[tileIdx];

  // Special tiles are already handled in rollAndMove, so just end turn if it's a special tile
  if (!tile.isOwnable) {
    endTurn();
    return;
  }

  // Ownable, not owned, player can buy
  if (!tile.isOwned()) {
    if ( player.gold >= tile.priceGold && player.units >= tile.priceUnits) {
      setMenu({ type: 'buy', tileIdx });
      return;
    } else {
      say(`${player.name} cannot afford to buy ${tile.name}.`, 'warning');
      setMenu({ type: 'end-turn' });
      return;
    }
  }

  // Ownable, owned by someone else
  if (tile.isOwned() && tile.owner !== player.name) {
    setMenu({ type: 'fee-or-fight', tileIdx });
    return;
  }

  // Else, just end turn
  endTurn();
}
