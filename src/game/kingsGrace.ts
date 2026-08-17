import { Player } from './Player';
import { MONEY_PASS_START, MONEY_PASS_START_FAME, FAME_STEP, UNITS_PASS_START } from './constants';
import { getArtifactGoldBonus } from './artifacts';

export interface KingsGraceReward {
  kingsGold: number;
  kingsUnits: number;
  arifactGold: number;
  totalGold: number;
  totalUnits: number;
}

/**
 * The reward for passing (or about to pass) the King's Castle: a per-fame
 * grace from the King, plus any artifact gold bonus (Pristine Diamond) --
 * NOT the player's own tiles any more, which pay out every turn instead
 * (see game/income.ts's collectTileTurnIncome). Shared by the actual payout
 * (passStart.ts) and its preview (CurrentPlayer.tsx) so they can't drift
 * apart.
 */
export function computeAnnualReward(player: Player): KingsGraceReward {
  const fame = player.fame || 1;
  const fameMultiplier = Math.floor(fame / FAME_STEP);
  const kingsGold = MONEY_PASS_START + MONEY_PASS_START_FAME * fameMultiplier;
  const kingsUnits = UNITS_PASS_START * fameMultiplier;
  const arifactGold = getArtifactGoldBonus(player);

  return {
    kingsGold,
    kingsUnits,
    arifactGold,
    totalGold: kingsGold + arifactGold,
    totalUnits: kingsUnits,
  };
}
