import {
  MILITIA_CAP_BY_FAME,
  RIDER_CAP_BY_FAME,
  MILITIA_POWER_WEIGHT,
  RIDER_DUEL_MULTIPLIER,
  ZOMBIE_POWER_WEIGHT,
  DRAGON_POWER_WEIGHT,
  DRAGON_UNITS,
  BANZAI_THRESHOLD,
  GARRISON_BONUS_SLOTS,
} from './constants';
import { getOverrides } from '../utils/overridesStore';

/** Units per tile garrison slot — overridable live (⚖️ screen). */
export function garrisonSlotCapacity(): number {
  return getOverrides().garrisonSlotCapacity;
}

/** Garrison slots a tile of this level holds -- scales with level, plus
 * GARRISON_BONUS_SLOTS (see Tile.garrisonSlots, which calls this). The
 * single source of truth every "max garrison" display must go through,
 * since a display computing level + 0 instead of level + GARRISON_BONUS_SLOTS
 * would show a cap the slider itself doesn't enforce. */
export function garrisonSlotsForLevel(level: number): number {
  return level + GARRISON_BONUS_SLOTS;
}

/** Total militia/riders headcount a tile of this level's garrison can hold. */
export function garrisonCapacityForLevel(level: number): number {
  return garrisonSlotCapacity() * garrisonSlotsForLevel(level);
}

export type UnitTier = 'militia' | 'riders';

/** Weighted combat value of a militia/riders pair — what battle-eligibility
 * thresholds (dragon, tile defence, Hero's Hour, caravan/ambush) compare
 * against, instead of raw headcount. */
export function computeArmyPower(militia: number, riders: number): number {
  return militia * MILITIA_POWER_WEIGHT + riders * RIDER_DUEL_MULTIPLIER;
}

/** Per-unit strength of every kind that can hold a battlefield, in militia. */
export const UNIT_POWER: Record<'militia' | 'riders' | 'zombies' | 'dragons', number> = {
  militia: MILITIA_POWER_WEIGHT,
  riders: RIDER_DUEL_MULTIPLIER,
  zombies: ZOMBIE_POWER_WEIGHT,
  dragons: DRAGON_POWER_WEIGHT,
};

/**
 * Strength of any mixed force on the shared militia-equivalent scale — the
 * general form of computeArmyPower, extended to the two NPC kinds so a
 * player's army and a zombie garrison (or the Dragon) can be compared
 * directly. Divide two of these to express one force in units of another:
 * forcePower({militia:22, riders:9}) / UNIT_POWER.dragons ≈ 14 dragons.
 */
export function forcePower(force: {
  militia?: number;
  riders?: number;
  zombies?: number;
  dragons?: number;
}): number {
  return (
    (force.militia ?? 0) * UNIT_POWER.militia +
    (force.riders ?? 0) * UNIT_POWER.riders +
    (force.zombies ?? 0) * UNIT_POWER.zombies +
    (force.dragons ?? 0) * UNIT_POWER.dragons
  );
}

/** What the Dragon's whole host is worth on the same scale. */
export const DRAGON_FORCE_POWER = forcePower({ dragons: DRAGON_UNITS });

/**
 * A banzai attack: too weak to win outright, but close enough to the tile's
 * defence to be worth the gamble. The single definition -- the tile card's
 * 🩸 badge, its button, and Tile.isAffordable all read it, so the badge can
 * never advertise an attack the button then refuses.
 */
export function isBanzaiAttack(lvl1Defence: number, attackerPower: number): boolean {
  return attackerPower >= lvl1Defence * BANZAI_THRESHOLD && attackerPower < lvl1Defence;
}

function capForFame(table: { minFame: number; cap: number }[], fame: number): number {
  return (table.find((t) => fame >= t.minFame) ?? table[table.length - 1]).cap;
}

/** A cap for display -- the unlimited top rider bracket reads as ∞. */
export function formatArmyCap(cap: number): string {
  return Number.isFinite(cap) ? String(cap) : '∞';
}

/** Militia/rider headcount caps at a given fame (before the knighthood gate
 * Player.armyCapacity applies to riders). */
export function armyCapacityForFame(fame: number): { militia: number; riders: number } {
  return { militia: capForFame(MILITIA_CAP_BY_FAME, fame), riders: capForFame(RIDER_CAP_BY_FAME, fame) };
}

/** How many more of `tier` a slotted force (a tile garrison) can take: each
 * tier rounds up to whole slots of `capacity`, and a slot can't be shared. */
export function remainingCapacity(
  militia: number,
  riders: number,
  slotCount: number,
  tier: UnitTier,
  capacity: number
): number {
  const thisCount = tier === 'militia' ? militia : riders;
  const otherCount = tier === 'militia' ? riders : militia;
  const otherSlots = Math.ceil(otherCount / capacity);
  const availableSlots = Math.max(0, slotCount - otherSlots);
  return Math.max(0, availableSlots * capacity - thisCount);
}

/**
 * Split a battle grid of `gridSize` cells into a militia/riders count,
 * proportional to a real militia/riders pair — used when the grid's cell
 * count doesn't exactly equal that pair's raw headcount (e.g. a tile's
 * defence grid is sized by weighted garrison power, not garrison headcount).
 * Falls back to all-militia when there's no real composition to reflect.
 */
export function proportionalTierSplit(
  gridSize: number,
  militia: number,
  riders: number
): { militiaCount: number; ridersCount: number } {
  const total = militia + riders;
  if (total <= 0 || gridSize <= 0) return { militiaCount: gridSize, ridersCount: 0 };
  const ridersCount = Math.min(gridSize, Math.round(gridSize * (riders / total)));
  return { militiaCount: gridSize - ridersCount, ridersCount };
}
