import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { rollDice } from '../game/Dice';
import { becomeBeggar } from './becomeBeggar';
import { showScreen, showPrisonScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { payFee } from './payFee';

export function fightTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void
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
      board.gameMessage = `${player.name} failed to raze ${tile.name}. Lost ${defence}🧍 and paid ${fee}🟡 to ${owner.name}.`;
      updateGameState(board);
      showScreen({
        background: 'assets/screens/lost.jpg',
        message: board.gameMessage,
        buttons: [{ label: 'Continue', action: 'end-turn', onClick: () => { clearScreen(); setEndTurn(); } }],
      });
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

      const ownerColor = owner ? board.players.find((p: Player) => p.name === tile.owner)?.color : undefined;

      if (bestOwnedIdx >= 0) {
        say(`${player.name} must sell tiles to pay the defeat penalty`, 'warning');
        board.gameMessage = `Cannot pay ${fee}🟡 defeat penalty to ${owner?.name}. Sell tiles to raise funds!`;
        updateGameState(board);
        showScreen({
          background: 'assets/screens/guards.jpg',
          fade: true,
          sprite: tile.sprite,
          encounter: {
            playerName: player.name,
            playerColor: player.color,
            tileName: tile.name,
            ownerName: tile.owner ?? undefined,
            ownerColor,
            subMessage: board.gameMessage,
          },
          sellMode: true,
          sellHeader: `Sell your tiles to pay fee or yield to ${tile.owner}!`,
          buttons: [
            { label: `Pay fee ${fee}🟡`, onClick: () => payFee(board, updateGameState), disabled: player.gold < fee },
            { label: `Raze ⚔️🔥`, onClick: () => fightTile(board, updateGameState), disabled: player.units < defence },
            { label: `Accept loss 😢`, onClick: () => { becomeBeggar(board, updateGameState); showPrisonScreen(board.gameMessage); } },
          ],
        });
      } else {
        say(`${player.name} cannot pay the defeat penalty`, 'error');
        becomeBeggar(board, updateGameState);
        showPrisonScreen(board.gameMessage);
      }
    }
  } else {
    say(`${player.name} razed the ${tile.name} with high price of  ${defence}🧍`, 'success');
    player.units -= defence;

    const prevOwner = tile.owner;
    tile._level = 1;
    tile.owner = undefined;

    board.players.forEach((p: Player) => {
      p.ownedTiles = p.ownedTiles.filter((idx: number) => idx !== player.position);
    });

    board.gameMessage = `${player.name} razed ${tile.name}! ${prevOwner} lost the tile. Cost: ${defence}🧍.`;
    updateGameState(board);
    showScreen({
      background: 'assets/screens/victory.jpg',
      message: board.gameMessage,
      buttons: [{ label: 'Continue', action: 'end-turn', onClick: () => { clearScreen(); setEndTurn(); } }],
    });
  }
}
