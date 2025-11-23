import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';

export function payFee(
  menu: MenuState | null,
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board || !menu) return;
  const tile = board.tiles[menu.tileIdx!];
  const player = board.activePlayer;
  const tileLevel = tile.level;
  const owner = board.players.find((p) => p.name === tile.owner);
  const fee = tile.bonuses[String(tileLevel)] || 0;
  if (player.gold >= fee && owner) {
    player.gold -= fee;
    owner.gold += fee;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  }
  endTurn();
}

