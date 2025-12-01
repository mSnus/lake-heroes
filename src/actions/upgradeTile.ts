import { Board } from '../game/Board';

export function upgradeTile(
  tileIdx: number,
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board) return;
  const player = board.activePlayer;
  const tile = board.tiles[tileIdx];
  if (tile.owner !== player.name) return;

  const currentlevel = tile.level;

  if (currentlevel >= 3) return;

  const nextlevel = (currentlevel + 1) as 2 | 3;

  const price = tile.upgradePrices[nextlevel];
  if (!price) return;
  if (player.gold >= price.gold && player.units >= price.units) {
    player.gold -= price.gold;
    player.units -= price.units;
    tile.level = nextlevel;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  }
  endTurn();
}
