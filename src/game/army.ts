import {
  ARMY_SLOT_CAPACITY,
  ARMY_SLOT_FAME_STEP,
  MAX_ARMY_SLOTS,
  MILITIA_POWER_WEIGHT,
  RIDER_POWER_WEIGHT,
} from './constants';

export type UnitTier = 'militia' | 'riders';

/** Weighted combat value of a militia/riders pair — what battle-eligibility
 * thresholds (dragon, tile defence, Hero's Hour, caravan/ambush) compare
 * against, instead of raw headcount. */
export function computeArmyPower(militia: number, riders: number): number {
  return militia * MILITIA_POWER_WEIGHT + riders * RIDER_POWER_WEIGHT;
}

/** How many army slots a given fame grants (1 at low fame, up to MAX_ARMY_SLOTS). */
export function slotCountForFame(fame: number): number {
  return Math.min(MAX_ARMY_SLOTS, 1 + Math.floor(fame / ARMY_SLOT_FAME_STEP));
}

/** Slots consumed by a militia/riders pair — each tier rounds up independently
 * (a slot can't be shared between tiers), matching the "5 slots, up to 10 of
 * one tier each" design. */
export function computeSlotsUsed(militia: number, riders: number): number {
  return Math.ceil(militia / ARMY_SLOT_CAPACITY) + Math.ceil(riders / ARMY_SLOT_CAPACITY);
}

/** How many more of `tier` can be added given the current composition and
 * total slot count — the cap that makes Riders worth their price (militia
 * alone caps out at slotCount*10 power; Riders are the only way past that). */
export function remainingCapacity(
  militia: number,
  riders: number,
  slotCount: number,
  tier: UnitTier
): number {
  const thisCount = tier === 'militia' ? militia : riders;
  const otherCount = tier === 'militia' ? riders : militia;
  const otherSlots = Math.ceil(otherCount / ARMY_SLOT_CAPACITY);
  const availableSlots = Math.max(0, slotCount - otherSlots);
  return Math.max(0, availableSlots * ARMY_SLOT_CAPACITY - thisCount);
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
