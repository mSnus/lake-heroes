import { FEE_MULTIPLIER } from '../components/board/common';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { becomeBeggar } from './becomeBeggar';

export function afterMoveLogic(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  const player = board.activePlayer;
  const tile = board.activeTile;

  console.log(`Action: after move logic for ${player.name} on ${tile.name}`, player, tile);

  // Special tiles are already handled in rollAndMove, so just end turn if it's a special tile
  if (!tile.isOwnable) {
    setMenu({ type: 'end-turn' });
    gameEvent('hideDice', true);
    return;
  }

  // Ownable, owned by someone else
  if (tile.isOwned() && tile.owner !== player.name) {
    const fee = tile.fee;
    const defence = tile.defence;

    if (player.gold < fee && player.units < defence) {
      // Check if player has tiles to sell
      const ownedTiles = board.tiles.filter((t) => t.owner === player.name);
      if (ownedTiles.length > 0) {
        // Find tile with minimal value
        let minTile = -1;
        let minVal = Infinity;

        ownedTiles.forEach((t, index) => {
          const price = t.currentPrice;
          const val = price.gold + price.units * 100;
          if (val < minVal && val >= fee) {
            minVal = val;
            minTile = index;
          }
        });

        if (minTile > 0) {
          say(`${player.name} sells ${ownedTiles[minTile].name} to pay the fee`, 'warning');
          setMenu({ type: 'sell-to-pay', tileIdx: minTile });
          return;
        }
      }

      say(
        `${player.name} cannot afford to pay the fee or fight the defences on ${tile.name}.`,
        'error'
      );
      becomeBeggar(board, updateGameState);
      setMenu({ type: 'end-turn' });
    } else {
      setMenu({ type: 'fee-or-fight' });
      return;
    }
  }

  // Else, just end turn
  setMenu({ type: 'end-turn' });
}
