import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

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
  const defence = tile.defences[tileLevel] || 0;

  const dice = new Dice();
  const roll = dice.roll();

  if (player.units < defence) {
    return say(`Not enough units to fight for the ${tile.name}`, 'error');
  }

  say(`${player.name} rolled ${roll} for the battle`, 'info');

  if (roll < 4) {
    say(`Battle for the ${tile.name} was lost, ${defence}🧍 died`, 'error');
    player.units -= defence;

    setMenu({ type: 'end-turn'});
  } else {
    say(`${player.name} razed the ${tile.name} with high price of  ${defence}🧍`, 'success');
    player.units -= defence;

    tile.level = 1;
    tile.owner = undefined;
    // Remove from previous owner's ownedTiles
    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((idx) => idx !== menu.tileIdx);
    });

    setMenu({ type: 'main'});
  }

   setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
}

