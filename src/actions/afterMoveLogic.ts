import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';

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

  console.debug('After move logic for tile:', tile);

  // Special tiles are already handled in rollAndMove, so just end turn if it's a special tile
  if (!tile.isOwnable) {
    endTurn();
    return;
  }

  // Ownable, not owned, player can buy
  if (!tile.isOwned() && player.gold >= tile.priceGold && player.units >= tile.priceUnits) {
    setMenu({ type: 'buy', tileIdx });
    return;
  }
  
  // Ownable, owned by someone else
  if (tile.isOwned() && tile.owner !== player.name) {
    setMenu({ type: 'fee-or-fight', tileIdx });
    return;
  }

  // Else, just end turn
  endTurn();
}

