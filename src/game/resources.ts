import { Player } from './Player';
import { UnitTier } from './army';
import { HARVEST_BUY_PRICE, HARVEST_SELL_PRICE } from './constants';
import { getOverrides } from '../utils/overridesStore';

export type Resource = 'food' | 'arms';

/** What one unit (or one upgrade) costs. */
export interface Cost {
  gold: number;
  food: number;
  arms: number;
}

/** One unit of `tier` at the King's Castle -- `goldOverride` replaces only
 * the gold part (the Tavern's premium, see tavern.ts). */
export function unitCost(tier: UnitTier, goldOverride?: number): Cost {
  const ov = getOverrides();
  return tier === 'riders'
    ? { gold: goldOverride ?? ov.riderPrice, food: ov.riderFood, arms: ov.riderArms }
    : { gold: goldOverride ?? ov.militiaPrice, food: ov.militiaFood, arms: ov.militiaArms };
}

/** Turning one militia into a rider: the difference between the two
 * recipes, with an optional gold-part override (the Tavern's premium). */
export function upgradeCost(goldOverride?: number): Cost {
  const militia = unitCost('militia');
  const rider = unitCost('riders');
  return {
    gold: Math.max(0, goldOverride ?? rider.gold - militia.gold),
    food: Math.max(0, rider.food - militia.food),
    arms: Math.max(0, rider.arms - militia.arms),
  };
}

export function scaleCost(cost: Cost, n: number): Cost {
  return { gold: cost.gold * n, food: cost.food * n, arms: cost.arms * n };
}

// Stand-in for "unlimited" when every part of a cost is 0 (only via overrides).
const FREE_COST_MAX = 9999;

/** How many of `cost` the player can pay for with what they hold. */
export function maxAffordable(player: Pick<Player, 'gold' | 'food' | 'arms'>, cost: Cost): number {
  const by = (have: number, need: number) => (need > 0 ? Math.floor(have / need) : Infinity);
  const n = Math.min(by(player.gold, cost.gold), by(player.food, cost.food), by(player.arms, cost.arms));
  return Number.isFinite(n) ? Math.max(0, n) : FREE_COST_MAX;
}

export function canPay(player: Pick<Player, 'gold' | 'food' | 'arms'>, cost: Cost): boolean {
  return player.gold >= cost.gold && player.food >= cost.food && player.arms >= cost.arms;
}

export function pay(player: Player, cost: Cost): void {
  player.gold -= cost.gold;
  player.food -= cost.food;
  player.arms -= cost.arms;
}

export function refund(player: Player, cost: Cost): void {
  player.gold += cost.gold;
  player.food += cost.food;
  player.arms += cost.arms;
}

/** Food and arms valued in gold, at what the Harvest pays for them. */
export function resourcesGoldValue(player: Pick<Player, 'food' | 'arms'>): number {
  return ((player.food ?? 0) + (player.arms ?? 0)) * HARVEST_SELL_PRICE;
}

/** A unit's full recipe valued in gold (food and arms at the Harvest's sell price). */
export function unitGoldValue(tier: UnitTier): number {
  const c = unitCost(tier);
  return c.gold + (c.food + c.arms) * HARVEST_SELL_PRICE;
}

/** "20🟡 10🍞 10⚔️", leaving out the zero parts ("0🟡" when all are zero). */
export function formatCost(cost: Cost): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${cost.gold}🟡`);
  if (cost.food) parts.push(`${cost.food}🍞`);
  if (cost.arms) parts.push(`${cost.arms}⚔️`);
  return parts.length ? parts.join(' ') : '0🟡';
}

/** Most units of `tier` the player can hire now: resources and army room. */
export function hireMax(player: Player, tier: UnitTier, goldOverride?: number): number {
  return Math.min(maxAffordable(player, unitCost(tier, goldOverride)), player.armyRoom(tier));
}

/** Buy (positive `amount`) or sell (negative) food or arms for gold at the
 * Harvest's fixed prices -- clamped to what the player can pay or holds. */
export function tradeResource(player: Player, resource: Resource, amount: number): number {
  if (amount > 0) {
    const bought = Math.min(amount, Math.floor(player.gold / HARVEST_BUY_PRICE));
    player.gold -= bought * HARVEST_BUY_PRICE;
    player[resource] += bought;
    return bought;
  }

  const sold = Math.min(-amount, player[resource]);
  player[resource] -= sold;
  player.gold += sold * HARVEST_SELL_PRICE;
  return -sold;
}
