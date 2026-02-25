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
      // Check if player has tiles to sell — find cheapest owned tile worth >= fee
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
        const tileToSell = board.tiles[player.ownedTiles[bestOwnedIdx]];
        say(`${player.name} sells ${tileToSell.name} to pay the fee`, 'warning');
        setMenu({ type: 'sell-to-pay', tileIdx: bestOwnedIdx });
        return;
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
