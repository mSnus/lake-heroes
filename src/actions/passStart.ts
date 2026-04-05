import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { MONEY_PASS_START } from '../game/constants';

export function passStart(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const player = board.activePlayer;
  const baseGold = MONEY_PASS_START;

  board.circles += 1;
  console.log('Action: pass start for', player.name);

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
  const totalGold = baseGold + goldProfit;
  const leadershipUnits = player.leadership ?? 1;
  player.gold += totalGold;
  player.units += unitsProfit + leadershipUnits;

  // Build toast message summarizing rewards
  const parts: string[] = [];

  if (totalGold > 0) parts.push(`${totalGold}🟡`);
  const totalUnits = unitsProfit + leadershipUnits;
  if (totalUnits > 0) parts.push(`${totalUnits}🧍`);

  const summary = parts.join(' and ');

  say(`${player.name} receives ${summary}`, 'success');

  if (!board.activeTile.name.toLowerCase().startsWith('king')) {
    board.gameMessage = `The King rewards you with ${summary} for your service and properties`;
  }
  updateGameState(board);
}

