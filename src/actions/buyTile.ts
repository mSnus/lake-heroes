import { Board } from '../game/Board';

export function buyTile(
  board: Board | null,
  setBoard: (board: Board) => void
) {
  if (!board) return;

  const player = board.activePlayer;
  const tile = board.tiles[player.position];
  
  if (player.gold >= tile.priceGold && player.units >= tile.priceUnits && !tile.isOwned()) {
    player.gold -= tile.priceGold;
    player.units -= tile.priceUnits;
    tile.owner = player.name;
    player.ownedTiles.push(player.position);
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  }
}

