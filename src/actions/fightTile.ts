import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { rollDice } from '../game/Dice';
import { becomeBeggar } from './becomeBeggar';

export function fightTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  console.log('Action: fight tile');

  const player = board.activePlayer;
  const tile = board.activeTile;
  const defence = tile.defence;

  const roll = rollDice();

  if (player.units < defence) {
    return say(`Not enough units to fight for the ${tile.name}`, 'error');
  }

  say(`${player.name} rolled ${roll} for the battle`, 'info');

  if (roll < 4) {
    say(`Battle for the ${tile.name} was lost, ${defence}🧍 died`, 'error');
    player.units -= defence;

    // After a lost battle, the fee must still be paid
    const fee = tile.fee;
    const owner = board.players.find((p: Player) => p.name === tile.owner);

    if (owner && player.gold >= fee) {
      player.gold -= fee;
      if (owner.turnsToSkip <= 0) owner.gold += fee;
      say(`${player.name} also paid ${fee}🟡 as defeat penalty to ${owner.name}.`, 'warning');
      updateGameState(board);
      setMenu({ type: 'fight-lose' });
    } else {
      // Can't pay fee — find a tile to sell or go bankrupt
      updateGameState(board);
      let bestOwnedIdx = -1;
      let minVal = Infinity;
      player.ownedTiles.forEach((posIdx, ownedIdx) => {
        const t = board.tiles[posIdx];
        if (!t || t.owner !== player.name) return;
        const price = t.currentPrice;
        const val = price.gold + price.units * 100;
        if (val < minVal && val >= fee) {
          minVal = val;
          bestOwnedIdx = ownedIdx;
        }
      });

      if (bestOwnedIdx >= 0) {
        say(`${player.name} must sell tiles to pay the defeat penalty`, 'warning');
        setMenu({ type: 'sell-to-pay', tileIdx: bestOwnedIdx });
      } else {
        say(`${player.name} cannot pay the defeat penalty`, 'error');
        becomeBeggar(board, updateGameState);
        setMenu({ type: 'end-turn' });
      }
    }
  } else {
    say(`${player.name} razed the ${tile.name} with high price of  ${defence}🧍`, 'success');
    player.units -= defence;

    tile._level = 1;
    tile.owner = undefined;

    board.players.forEach((p: Player) => {
      p.ownedTiles = p.ownedTiles.filter((idx: number) => idx !== player.position);
    });

    updateGameState(board);
    setMenu({ type: 'fight-win' });
  }
}
