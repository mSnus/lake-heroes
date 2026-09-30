import { Player } from '../game/Player';
import { UnitTier, remainingCapacity, slotChunks } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { upgradeSquadCost } from '../actions/upgradeSquad';
import { getCharacterConfig, pickKingsCastleHireAmount, pickKingsCastleHireTier } from './decisions';

/**
 * Bot plans that used to live inside screen components' useEffects, which made
 * them unreachable without rendering. Pulled out so the live game and the
 * headless economy simulator decide identically -- the same drift trap the
 * battle simulator fell into.
 */

/** What a bot buys at the King's Castle (any tier) or the Tavern (militia,
 * with priceOverride set to the Tavern's own premium price -- see
 * tavern.ts's tavernMilitiaPrice). */
export function planUnitHire(
  player: Player,
  forcedTier?: UnitTier,
  priceOverride?: number
): { tier: UnitTier; amount: number } {
  const tier = forcedTier ?? pickKingsCastleHireTier(player);
  const ov = getOverrides();
  const price = priceOverride ?? (tier === 'riders' ? ov.riderPrice : ov.militiaPrice);
  const maxAmount = Math.min(Math.floor(player.gold / price), player.remainingCapacity(tier));
  return { tier, amount: pickKingsCastleHireAmount(player, maxAmount, price) };
}

/** One move in a bot's shopping trip at the King's Castle (or the Tavern,
 * with its own premium prices -- see PriceOverrides). */
export type ArmyStep =
  | { kind: 'sell'; tier: UnitTier; count: number }
  | { kind: 'hire'; tier: UnitTier; count: number }
  | { kind: 'upgrade'; count: number };

/** Overrides both unit prices at once -- the Tavern charges its own premium
 * rate for militia AND riders (see tavern.ts's tavernMilitiaPrice/
 * tavernRiderPrice), unlike planUnitHire's single-tier priceOverride. */
export interface PriceOverrides {
  militiaPrice: number;
  riderPrice: number;
}

// Every step either spends gold or disbands a squad, so the loop below can't
// run away -- but overrides can set a 0 unit price, which makes "how many can
// I afford" unbounded. Cheap insurance.
const MAX_ARMY_STEPS = 24;

/**
 * Riders are the only way past the militia power ceiling (militia alone caps
 * at slots x capacity), so a Knight bot spends its way toward them:
 *
 * 1. Any rider capacity going spare gets filled, as far as gold allows.
 * 2. Once nothing is spare, convert the smallest militia squad into riders
 *    in place via upgradeSquad -- a whole squad moving tiers never needs
 *    more slots (see maxUpgradable), so it needs no capacity room and is a guaranteed
 *    power gain at any amount the bot can afford, unlike disbanding for a
 *    fresh hire which used to require affording back at least half the
 *    squad given up.
 * 3. Re-check with the new gold/squad counts, and keep going until neither
 *    rule fires.
 *
 * Same for every character -- there's no rider-shy personality. Non-Knights
 * can't recruit riders at all, so they fall through to militia.
 */
function planRiderBuildUp(player: Player, prices: PriceOverrides): ArmyStep[] {
  if (!player.isKnight) return [];
  if (prices.riderPrice <= 0) return [];

  const ov = getOverrides();
  const slots = player.armySlots;
  const cap = ov.armySlotCapacity;
  let gold = player.gold;
  let militia = player.militia;
  let riders = player.riders;
  const steps: ArmyStep[] = [];

  for (let guard = 0; guard < MAX_ARMY_STEPS; guard++) {
    const affordable = Math.floor(gold / prices.riderPrice);
    if (affordable >= 1) {
      const room = remainingCapacity(militia, riders, slots, 'riders', cap);
      if (room > 0) {
        const count = Math.min(affordable, room);
        steps.push({ kind: 'hire', tier: 'riders', count });
        gold -= count * prices.riderPrice;
        riders += count;
        continue;
      }
    }

    const chunks = slotChunks(militia, cap);
    if (chunks.length === 0) break;
    const smallest = Math.min(...chunks);
    const upgradeCost = upgradeSquadCost(smallest, prices.riderPrice - prices.militiaPrice);
    if (gold < upgradeCost) break;

    steps.push({ kind: 'upgrade', count: smallest });
    gold -= upgradeCost;
    militia -= smallest;
    riders += smallest;
  }

  return steps;
}

/**
 * The bot's whole shopping trip at the King's Castle (or the Tavern, passing
 * its own premium prices), in order. Riders first (see planRiderBuildUp); a
 * bot that can't or shouldn't buy riders tops up militia the way it always
 * did (unless `ridersOnly`). `prices` defaults to the normal King's Castle
 * prices.
 */
export function planArmyPurchase(
  player: Player,
  prices?: PriceOverrides,
  opts: { ridersOnly?: boolean } = {}
): ArmyStep[] {
  const ov = getOverrides();
  const resolvedPrices = prices ?? { militiaPrice: ov.militiaPrice, riderPrice: ov.riderPrice };
  const riderSteps = planRiderBuildUp(player, resolvedPrices);
  if (riderSteps.length > 0) return riderSteps;
  // The Stables sells riders only, so there is no militia to top up with.
  if (opts.ridersOnly) return [];

  const { tier, amount } = planUnitHire(player, 'militia', resolvedPrices.militiaPrice);
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
