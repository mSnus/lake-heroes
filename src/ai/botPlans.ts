import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { Cost, hireMax, maxAffordable, scaleCost, unitCost, upgradeCost } from '../game/resources';
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
  const maxAmount = hireMax(player, tier, price);
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

/**
 * A Knight bot spends its way toward riders, the stronger tier:
 *
 * 1. Any spare rider cap gets filled with fresh hires, as far as gold allows.
 * 2. Then militia on hand are upgraded in place (cheaper per rider than a
 *    fresh hire), as far as gold and the rider cap allow.
 *
 * Same for every character -- there's no rider-shy personality. Non-Knights
 * can't recruit riders at all, so they fall through to militia.
 */
function planRiderBuildUp(player: Player, prices: PriceOverrides): ArmyStep[] {
  if (!player.isKnight) return [];

  const wallet = { gold: player.gold, food: player.food, arms: player.arms };
  let riderRoom = player.armyRoom('riders');
  const steps: ArmyStep[] = [];

  const riderCost = unitCost('riders', prices.riderPrice);
  const hired = Math.min(maxAffordable(wallet, riderCost), riderRoom);
  if (hired > 0) {
    steps.push({ kind: 'hire', tier: 'riders', count: hired });
    const paid = scaleCost(riderCost, hired);
    wallet.gold -= paid.gold;
    wallet.food -= paid.food;
    wallet.arms -= paid.arms;
    riderRoom -= hired;
  }

  const upgraded = Math.min(
    player.militia,
    riderRoom,
    maxAffordable(wallet, upgradeCost(prices.riderPrice - prices.militiaPrice))
  );
  if (upgraded > 0) steps.push({ kind: 'upgrade', count: upgraded });

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

export type Wallet = Pick<Player, 'gold' | 'food' | 'arms'>;

export interface TurnHire {
  riders: number;
  militia: number;
  cost: Cost;
}

/**
 * What a bot hires at the start of every turn, at King's Castle prices:
 * riders first (Knights), then militia, each up to its own Fame cap, out of
 * the gold left after the character's turnHireGoldReserve.
 */
export function planTurnHire(player: Player, wallet: Wallet = player): TurnHire {
  const cfg = getCharacterConfig(player);
  const none: TurnHire = { riders: 0, militia: 0, cost: { gold: 0, food: 0, arms: 0 } };
  if (!cfg) return none;

  const left = {
    gold: Math.floor(wallet.gold * (1 - cfg.turnHireGoldReserve) + 1e-9),
    food: wallet.food,
    arms: wallet.arms,
  };
  const take = (tier: UnitTier): number => {
    const cost = unitCost(tier);
    const n = Math.min(maxAffordable(left, cost), player.armyRoom(tier));
    const paid = scaleCost(cost, n);
    left.gold -= paid.gold;
    left.food -= paid.food;
    left.arms -= paid.arms;
    return n;
  };

  const riders = player.isKnight ? take('riders') : 0;
  const militia = take('militia');
  const cost = addCosts(scaleCost(unitCost('riders'), riders), scaleCost(unitCost('militia'), militia));
  return { riders, militia, cost };
}

function addCosts(a: Cost, b: Cost): Cost {
  return { gold: a.gold + b.gold, food: a.food + b.food, arms: a.arms + b.arms };
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
