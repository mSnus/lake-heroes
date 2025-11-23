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

  // Special tiles are already handled in rollAndMove, so just end turn if it's a special tile
  if (
    tile.name.includes('Treasure box') ||
    tile.name.includes('Rogue camp') ||
    tile.name.includes('Prison') ||
    tile.name.includes('King Castle')
  ) {
    endTurn();
    return;
  }

  // Not ownable or already owned by player
  if (!tile.isOwnable || tile.owner === player.name) {
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

