import { GameState } from '../game/GameState';
import { playerWealth, richestPlayer } from '../game/wealth';

/**
 * Ransom a prisoner of war as they're about to leave prison: the King grants
 * them half of the richest player's wealth (in both gold and units) and clears
 * the flag. Sets the game message announcing the gift.
 */
export function releasePrisonerOfWar(board: GameState): void {
  const player = board.activePlayer;
  player.isPrisonerOfWar = false;

  // Both halves of the gift come from the wealthiest player.
  const richestP = richestPlayer(board);
  const richest = richestP ? playerWealth(board, richestP) : { gold: 0, units: 0 };

  const goldGift = Math.floor(richest.gold / 2);
  const unitsGift = Math.floor(richest.units / 2);

  player.gold += goldGift;
  player.units += unitsGift;

  board.gameMessage = `The King in his Grace sends you ${unitsGift}🧍 and ${goldGift}🟡`;
}
