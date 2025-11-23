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
  const currentLvl = tile.level;
  if (currentLvl >= 3) return;
  const nextLvl = (currentLvl + 1) as 2 | 3;
  const price = tile.upgradePrices[String(nextLvl)];
  if (!price) return;
  if (player.gold >= price.gold && player.units >= price.units) {
    player.gold -= price.gold;
    player.units -= price.units;
    tile.level = nextLvl;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  }
  endTurn();
}

