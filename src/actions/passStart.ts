import { Board } from '../game/Board';
import { say } from '../utils/say';

export function passStart(board: Board | null, setBoard: (board: Board) => void) {
  if (!board) return;
  const player = board.activePlayer;

  // Base reward for passing start
  const baseGold = 200;

  // Calculate profits from owned tiles based on their bonusType and level
  let goldProfit = 0;
  let unitsProfit = 0;
  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile) continue;
    if (tile.owner && tile.owner !== player.name) continue; // safety check

    const bonus = tile.bonuses[tile.level] || 0;
    if ((tile.bonusType || 'gold') === 'units') {
      unitsProfit += bonus;
    } else {
      goldProfit += bonus;
    }
  }

  // Apply rewards
  player.gold += baseGold + goldProfit;
  player.units += unitsProfit;

  // Persist state
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));

  // Build toast message summarizing rewards
  const parts: string[] = [];
  parts.push(`+${baseGold} GP`);
  if (goldProfit > 0) parts.push(`+${goldProfit}🟡 from own tiles`);
  if (unitsProfit > 0) parts.push(`+${unitsProfit}🧍 from own tiles`);
  const summary = parts.join(', ');
  say(`${player.name} passed start: ${summary}`, 'success');
}
