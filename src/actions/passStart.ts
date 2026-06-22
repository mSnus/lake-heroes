import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { computeKingsGraceReward } from '../game/kingsGrace';
import { changeFame } from '../utils/fame';

export function passStart(board: GameState | null, updateGameState: (board: GameState) => void): string {
  if (!board) return '';

  const player = board.activePlayer;
  // Computed before changeFame below, so the reward uses the fame the player
  // had while travelling, not the fame they're about to gain for arriving.
  const { totalGold, totalUnits } = computeKingsGraceReward(board, player);

  player.circles = (player.circles ?? 0) + 1;
  player.dragonEncounters = 0;
  player.caravanEncounters = 0;
  changeFame(player, 1);
  console.log('Action: pass start for', player.name);

  say(`${player.name} spent ${player.circles} years wandering, looking for a glory`, 'debug');

  // Apply rewards
  player.gold += totalGold;
  player.units += totalUnits;

  // Build toast message summarizing rewards
  const parts: string[] = [];

  if (totalGold > 0) parts.push(`${totalGold}🟡`);
  if (totalUnits > 0) parts.push(`${totalUnits}🧍`);

  const summary = parts.join(' and ');

  say(`${player.name} receives ${summary}`, 'success');

  updateGameState(board);
  return '';
}
