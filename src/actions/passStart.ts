import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { MONEY_PASS_START } from '../game/constants';
import { syndicateMultiplier } from '../game/syndicate';

export function passStart(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const player = board.activePlayer;
  const baseGold = MONEY_PASS_START;

  player.circles = (player.circles ?? 0) + 1;
  player.dragonEncounters = 0;
  player.caravanEncounters = 0;
  console.log('Action: pass start for', player.name);

  // Calculate profits from owned tiles based on their bonusType and level
  let goldProfit = 0;
  let unitsProfit = 0;
  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile) continue;
    if (tile.owner && tile.owner !== player.name) continue; // safety check

    const bonus = tile.bonuses[tile.level] || 0;
    const mult = syndicateMultiplier(board, player, tile.group);
    if ((tile.bonusType || 'gold') === 'units') {
      unitsProfit += bonus * mult;
    } else {
      goldProfit += bonus * mult;
    }
  }

  // Apply rewards
  const totalGold = baseGold + goldProfit;
  const fameUnits = player.fame ?? 1;
  player.gold += totalGold;
  player.units += unitsProfit + fameUnits;

  // Build toast message summarizing rewards
  const parts: string[] = [];

  if (totalGold > 0) parts.push(`${totalGold}🟡`);
  const totalUnits = unitsProfit + fameUnits;
  if (totalUnits > 0) parts.push(`${totalUnits}🧍`);

  const summary = parts.join(' and ');

  say(`${player.name} receives ${summary}`, 'success');

  if (!board.activeTile.name.toLowerCase().startsWith('king')) {
    board.gameMessage = `The King rewards you with ${summary} for your service and properties`;
  }

  updateGameState(board);
}
