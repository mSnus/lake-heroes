import { GameState } from '../game/GameState';
import { playerWealth } from '../game/wealth';
import { setGameMessage } from '../utils/gameMessage';
import { t } from '../i18n';

/**
 * Ransom a prisoner of war as they're about to leave prison: the King grants
 * them half of the realm's richest holding of each resource and clears the
 * flag. Sets the game message announcing the gift.
 *
 * Each half is measured against whoever actually holds the most OF THAT
 * RESOURCE, rather than against a single "richest player" picked by
 * totalWealth -- that ranking is dominated by army value (militia/rider
 * prices), so an all-army leader holding no gold and no tiles used to be
 * chosen as the donor and then yield a 0🟡 ransom.
 */
export function releasePrisonerOfWar(board: GameState): void {
  const player = board.activePlayer;
  player.isPrisonerOfWar = false;

  let richestGold = 0;
  let richestUnits = 0;
  for (const p of board.players) {
    const w = playerWealth(board, p);
    if (w.gold > richestGold) richestGold = w.gold;
    if (w.units > richestUnits) richestUnits = w.units;
  }

  // Rounded down to a clean 50, same as every other gold payout (see
  // game/income.ts and game/kingsGrace.ts).
  const goldGift = Math.floor(richestGold / 2 / 50) * 50;
  const unitsGift = Math.floor(richestUnits / 2);

  player.gold += goldGift;
  player.units += unitsGift;

  setGameMessage(board, t('releasePrisonerOfWar.message', { units: unitsGift, gold: goldGift }));
}
