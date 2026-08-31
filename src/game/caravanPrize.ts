import { Player } from './Player';
import { computeSlotsUsed } from './army';
import { getOverrides } from '../utils/overridesStore';

/** A caravan's cargo. Any component may be 0; gold and slaves are never
 * both 0 (see rollCaravanPrize). */
export interface CaravanPrize {
  gold: number;
  slaves: number;
  horses: number;
}

/** Independent per-component odds that a caravan carries each kind of
 * cargo. A caravan always carries gold or slaves, so when neither comes up
 * one is filled in, chosen between them in proportion to these two. */
export const CARAVAN_GOLD_CHANCE = 0.8;
export const CARAVAN_SLAVES_CHANCE = 0.35;
/** Horses only ever travel with a Knight's caravan — nobody else can field
 * riders, so there would be nothing to mount them. */
export const CARAVAN_HORSES_CHANCE = 0.2;
export const CARAVAN_HORSES_MAX = 12;

/** Chance that some of a beaten escort throws in with the victor, and the
 * most of each tier that ever does. */
export const CARAVAN_RECRUIT_CHANCE = 0.25;
export const CARAVAN_RECRUIT_MAX_SHARE = 0.2;

/**
 * Roll a caravan's cargo. `prizeUnits` is the escort's full headcount — the
 * measure of how rich a caravan worth that many guards is.
 */
export function rollCaravanPrize(prizeUnits: number, forKnight: boolean): CaravanPrize {
  let hasGold = Math.random() < CARAVAN_GOLD_CHANCE;
  let hasSlaves = Math.random() < CARAVAN_SLAVES_CHANCE;
  if (!hasGold && !hasSlaves) {
    const goldShare = CARAVAN_GOLD_CHANCE / (CARAVAN_GOLD_CHANCE + CARAVAN_SLAVES_CHANCE);
    if (Math.random() < goldShare) hasGold = true;
    else hasSlaves = true;
  }

  const hasHorses = forKnight && Math.random() < CARAVAN_HORSES_CHANCE;

  return {
    gold: hasGold ? 100 * prizeUnits * (Math.floor(Math.random() * 2.3) + 1) : 0,
    slaves: hasSlaves ? Math.max(1, Math.ceil(prizeUnits * (1.3 + Math.random() * 0.3))) : 0,
    horses: hasHorses ? 1 + Math.floor(Math.random() * CARAVAN_HORSES_MAX) : 0,
  };
}

/** Every component quartered — what a tied raid comes away with. */
export function quarterPrize(prize: CaravanPrize): CaravanPrize {
  return {
    gold: Math.floor(prize.gold / 4),
    slaves: Math.floor(prize.slaves / 4),
    horses: Math.floor(prize.horses / 4),
  };
}

/**
 * Mount captured horses: militia are promoted to riders, one per horse, as
 * many as the army has room to re-tier.
 *
 * Militia and riders each round up to whole slots, so a partial promotion
 * can cost a slot the army hasn't got (21 militia in 2 slots + 3 riders
 * needs 3). The largest promotion that keeps the army inside its slots is
 * therefore taken, which is exactly the authored rule: a whole militia slot
 * no bigger than the horse count converts in place, or a free slot takes
 * the new riders.
 *
 * @returns how many militia were promoted (0 if there was no room).
 */
export function mountHorses(player: Player, horses: number): number {
  if (horses <= 0 || !player.isKnight) return 0;

  const cap = getOverrides().armySlotCapacity;
  const slots = player.armySlots;
  const fits = (k: number) => computeSlotsUsed(player.militia - k, player.riders + k, cap) <= slots;

  for (let k = Math.min(horses, player.militia); k > 0; k--) {
    if (fits(k)) {
      player.militia -= k;
      player.riders += k;
      return k;
    }
  }

  return 0;
}

/**
 * Whether any of a beaten escort joins the victor, and how many of each
 * tier — rolled per tier, so a mounted escort's riders and footmen defect
 * independently. Returns zeroes most of the time.
 */
export function rollGuardsJoining(
  guardMilitia: number,
  guardRiders: number
): { militia: number; riders: number } {
  if (Math.random() >= CARAVAN_RECRUIT_CHANCE) return { militia: 0, riders: 0 };

  const share = () => Math.random() * CARAVAN_RECRUIT_MAX_SHARE;
  return {
    militia: Math.floor(guardMilitia * share()),
    riders: Math.floor(guardRiders * share()),
  };
}
