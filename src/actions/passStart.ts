import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { UNITS_START, MONEY_PASS_START } from '../components/board/common';

export function passStart(board: GameState | null, setGameState: (board: GameState) => void) {
  if (!board) return;
  const player = board.activePlayer;

  console.log('Action: pass start');

  const baseGold = MONEY_PASS_START;

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
  setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));

  // Build toast message summarizing rewards
  const parts: string[] = [];
  parts.push(`+${baseGold} GP`);

  if (goldProfit > 0) parts.push(`+${goldProfit}🟡 from own tiles`);
  if (unitsProfit > 0) parts.push(`+${unitsProfit}🧍 from own tiles`);
  
  const summary = parts.join(', ');
  
  say(`${player.name} receives ${summary}`, 'success');
}
