import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';

export function fightTile(
  menu: MenuState | null,
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void,
  endTurn: () => void
) {
  if (!board || !menu) return;
  const tile = board.tiles[menu.tileIdx!];
  const player = board.activePlayer;
  const tileLevel = tile.level;
  const defence = tile.defences[String(tileLevel)] || 0;
  if (player.units > defence) {
    player.units -= defence;
    tile.level = 1;
    tile.owner = undefined;
    // Remove from previous owner's ownedTiles
    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((idx) => idx !== menu.tileIdx);
    });
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
    // If now affordable, offer to buy; else end turn
    if (player.gold >= tile.priceGold && player.units >= tile.priceUnits) {
      setMenu({ type: 'buy', tileIdx: menu.tileIdx });
      return;
    }
  }
  endTurn();
}

