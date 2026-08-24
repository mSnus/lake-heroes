import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { getCharacterConfig, pickKingsCastleHireAmount, pickKingsCastleHireTier } from './decisions';

/**
 * Bot plans that used to live inside screen components' useEffects, which made
 * them unreachable without rendering. Pulled out so the live game and the
 * headless economy simulator decide identically -- the same drift trap the
 * battle simulator fell into.
 */

/** What a bot buys at the King's Castle (any tier) or the Tavern (militia). */
export function planUnitHire(
  player: Player,
  forcedTier?: UnitTier
): { tier: UnitTier; amount: number } {
  const tier = forcedTier ?? pickKingsCastleHireTier(player);
  const ov = getOverrides();
  const price = tier === 'riders' ? ov.riderPrice : ov.militiaPrice;
  const maxAmount = Math.min(Math.floor(player.gold / price), player.remainingCapacity(tier));
  return { tier, amount: pickKingsCastleHireAmount(player, maxAmount, price) };
}

/** How many militia a bot leaves guarding a tile it has just claimed. */
export function planClaimGarrison(
  player: Player,
  maxGarrison: number,
  totalMilitiaPool: number
): number {
  const fraction = getCharacterConfig(player)?.claimGarrisonFraction ?? 0;
  return Math.min(maxGarrison, Math.floor(fraction * totalMilitiaPool));
}
