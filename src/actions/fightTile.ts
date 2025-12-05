import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';
import { Player } from '../game/Player';

export function fightTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  console.log('Action: fight tile');

  const player = board.activePlayer;
  const tile = board.activeTile;
  const defence = tile.defences[tile.level] || 0;

  const dice = new Dice();
  const roll = dice.roll();

  if (player.units < defence) {
    return say(`Not enough units to fight for the ${tile.name}`, 'error');
  }

  say(`${player.name} rolled ${roll} for the battle`, 'info');

  if (roll < 4) {
    say(`Battle for the ${tile.name} was lost, ${defence}🧍 died`, 'error');
    player.units -= defence;

    setMenu({ type: 'end-turn' });
  } else {
    say(`${player.name} razed the ${tile.name} with high price of  ${defence}🧍`, 'success');
    player.units -= defence;

    tile._level = 1;
    tile.owner = undefined;

    board.players.forEach((p: Player) => {
      p.ownedTiles = p.ownedTiles.filter((idx: number) => idx !== player.position);
    });

    setMenu({ type: 'buy' });
  }

  updateGameState(board);
}
