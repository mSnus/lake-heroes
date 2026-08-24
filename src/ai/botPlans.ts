import { Player } from '../game/Player';
import { UnitTier, remainingCapacity, slotChunks } from '../game/army';
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

/** One move in a bot's shopping trip at the King's Castle. */
export type ArmyStep =
  | { kind: 'sell'; tier: UnitTier; count: number }
  | { kind: 'hire'; tier: UnitTier; count: number };

// Every step either spends gold or disbands a squad, so the loop below can't
// run away -- but overrides can set a 0 unit price, which makes "how many can
// I afford" unbounded. Cheap insurance.
const MAX_ARMY_STEPS = 24;

/**
 * Riders are the only way past the militia power ceiling (militia alone caps
 * at slots x capacity), so a Knight bot spends its way toward them:
 *
 * 1. Any rider capacity going spare gets filled, as far as gold allows.
 * 2. Once nothing is spare, the smallest militia squad is a candidate to be
 *    disbanded and re-spent on riders -- but only when the gold on hand buys
 *    at least half as many riders as the militia being given up, which is
 *    still a clear power gain (see computeArmyPower's weights).
 * 3. Re-check with the new gold/squad counts, and keep going until neither
 *    rule fires.
 *
 * Same for every character -- there's no rider-shy personality. Non-Knights
 * can't recruit riders at all, so they fall through to militia.
 */
function planRiderBuildUp(player: Player): ArmyStep[] {
  if (!player.isKnight) return [];

  const ov = getOverrides();
  if (ov.riderPrice <= 0) return [];

  const slots = player.armySlots;
  const cap = ov.armySlotCapacity;
  let gold = player.gold;
  let militia = player.militia;
  let riders = player.riders;
  const steps: ArmyStep[] = [];

  for (let guard = 0; guard < MAX_ARMY_STEPS; guard++) {
    const affordable = Math.floor(gold / ov.riderPrice);
    if (affordable < 1) break;

    const room = remainingCapacity(militia, riders, slots, 'riders', cap);
    if (room > 0) {
      const count = Math.min(affordable, room);
      steps.push({ kind: 'hire', tier: 'riders', count });
      gold -= count * ov.riderPrice;
      riders += count;
      continue;
    }

    const chunks = slotChunks(militia, cap);
    if (chunks.length === 0) break;
    const smallest = Math.min(...chunks);
    if (affordable < smallest / 2) break;

    steps.push({ kind: 'sell', tier: 'militia', count: smallest });
    gold += smallest * ov.militiaPrice;
    militia -= smallest;
  }

  return steps;
}

/**
 * The bot's whole King's Castle shopping trip, in order. Riders first (see
 * planRiderBuildUp); a bot that can't or shouldn't buy riders tops up
 * militia the way it always did.
 */
export function planArmyPurchase(player: Player): ArmyStep[] {
  const riderSteps = planRiderBuildUp(player);
  if (riderSteps.length > 0) return riderSteps;

  const { tier, amount } = planUnitHire(player, 'militia');
  return amount > 0 ? [{ kind: 'hire', tier, count: amount }] : [];
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
