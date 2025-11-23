import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';

export function buyTile(
  menu: MenuState | null,
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board || !menu) return;
  const tile = board.tiles[menu.tileIdx!];
  const player = board.activePlayer;
  if (player.gold >= tile.priceGold && player.units >= tile.priceUnits && !tile.isOwned()) {
    player.gold -= tile.priceGold;
    player.units -= tile.priceUnits;
    tile.owner = player.name;
    player.ownedTiles.push(menu.tileIdx!);
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  }
  endTurn();
}

