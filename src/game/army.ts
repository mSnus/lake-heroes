import {
  ARMY_SLOT_CAPACITY,
  ARMY_SLOT_FAME_THRESHOLDS,
  MILITIA_POWER_WEIGHT,
  RIDER_DUEL_MULTIPLIER,
} from './constants';

export type UnitTier = 'militia' | 'riders';

/** Weighted combat value of a militia/riders pair — what battle-eligibility
 * thresholds (dragon, tile defence, Hero's Hour, caravan/ambush) compare
 * against, instead of raw headcount. */
export function computeArmyPower(militia: number, riders: number): number {
  return militia * MILITIA_POWER_WEIGHT + riders * RIDER_DUEL_MULTIPLIER;
}

/** How many army slots a given fame grants — see ARMY_SLOT_FAME_THRESHOLDS. */
export function slotCountForFame(fame: number): number {
  const bracket = ARMY_SLOT_FAME_THRESHOLDS.find((t) => fame >= t.minFame);
  return bracket?.slots ?? ARMY_SLOT_FAME_THRESHOLDS[ARMY_SLOT_FAME_THRESHOLDS.length - 1].slots;
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
 * Break a tier's raw count into its individual slot-sized chunks (up to
 * ARMY_SLOT_CAPACITY each) for display — e.g. 14 -> [10, 4]. The data model
 * only stores the running total, not which slot a unit was actually added
 * to, so this is a simple greedy fill for display purposes, not a real
 * record of army history.
 */
export function slotChunks(count: number): number[] {
  if (count <= 0) return [];
  const chunks: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const chunk = Math.min(ARMY_SLOT_CAPACITY, remaining);
    chunks.push(chunk);
    remaining -= chunk;
  }
  return chunks;
}

export interface SquadChunk {
  tier: UnitTier;
  /** 0 for a still-empty slot. */
  count: number;
}

/**
 * Every army slot's contents, in display order: militia chunks, then rider
 * chunks, then any remaining slots padded out as empty (militia by default —
 * there's no tier to distinguish when a slot holds nothing yet). Used by
 * SquadDisplay to show the player's whole army, filled and empty slots alike.
 */
export function buildSquadChunks(militia: number, riders: number, totalSlots: number): SquadChunk[] {
  const chunks: SquadChunk[] = [
    ...slotChunks(militia).map((count) => ({ tier: 'militia' as const, count })),
    ...slotChunks(riders).map((count) => ({ tier: 'riders' as const, count })),
  ];
  while (chunks.length < totalSlots) chunks.push({ tier: 'militia', count: 0 });
  return chunks;
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
