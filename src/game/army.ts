import {
  ARMY_SLOT_FAME_THRESHOLDS,
  MILITIA_POWER_WEIGHT,
  RIDER_DUEL_MULTIPLIER,
  ZOMBIE_POWER_WEIGHT,
  DRAGON_POWER_WEIGHT,
  DRAGON_UNITS,
} from './constants';
import { getOverrides } from '../utils/overridesStore';

/** Units per player army slot — overridable live (⚖️ screen), independently
 * of a tile garrison's own per-slot capacity (see garrisonSlotCapacity). */
function slotCapacity(): number {
  return getOverrides().armySlotCapacity;
}

/** Units per tile garrison slot — overridable live (⚖️ screen), independently
 * of a player's own army slot capacity (see the private slotCapacity above).
 * Exported so Tile/garrison call sites can pass it explicitly to the
 * capacity-taking helpers below instead of defaulting to the army one. */
export function garrisonSlotCapacity(): number {
  return getOverrides().garrisonSlotCapacity;
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

/** How many army slots a given fame grants — see ARMY_SLOT_FAME_THRESHOLDS. */
export function slotCountForFame(fame: number): number {
  const bracket = ARMY_SLOT_FAME_THRESHOLDS.find((t) => fame >= t.minFame);
  return bracket?.slots ?? ARMY_SLOT_FAME_THRESHOLDS[ARMY_SLOT_FAME_THRESHOLDS.length - 1].slots;
}

/** Slots consumed by a militia/riders pair — each tier rounds up independently
 * (a slot can't be shared between tiers), matching the "5 slots, up to 10 of
 * one tier each" design. `capacity` defaults to the player army's per-slot
 * cap; pass garrisonSlotCapacity() for a tile garrison instead. */
export function computeSlotsUsed(militia: number, riders: number, capacity: number = slotCapacity()): number {
  return Math.ceil(militia / capacity) + Math.ceil(riders / capacity);
}

/** How many more of `tier` can be added given the current composition and
 * total slot count — the cap that makes Riders worth their price (militia
 * alone caps out at slotCount*10 power; Riders are the only way past that).
 * `capacity` defaults to the player army's per-slot cap; pass
 * garrisonSlotCapacity() for a tile garrison instead. */
export function remainingCapacity(
  militia: number,
  riders: number,
  slotCount: number,
  tier: UnitTier,
  capacity: number = slotCapacity()
): number {
  const thisCount = tier === 'militia' ? militia : riders;
  const otherCount = tier === 'militia' ? riders : militia;
  const otherSlots = Math.ceil(otherCount / capacity);
  const availableSlots = Math.max(0, slotCount - otherSlots);
  return Math.max(0, availableSlots * capacity - thisCount);
}

/**
 * Break a tier's raw count into its individual slot-sized chunks (up to
 * `capacity` each, defaulting to the player army's per-slot cap) for display
 * — e.g. 14 -> [10, 4]. The data model only stores the running total, not
 * which slot a unit was actually added to, so this is a simple greedy fill
 * for display purposes, not a real record of army history.
 */
export function slotChunks(count: number, capacity: number = slotCapacity()): number[] {
  if (count <= 0) return [];
  const chunks: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const chunk = Math.min(capacity, remaining);
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
