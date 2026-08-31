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

/** Slaves carried, as a fraction of the escort's own headcount. Kept in
 * rough parity with what the gold branch buys (a caravan's gold runs to
 * 1-3x 100 per escort head, i.e. a fifth to two-fifths of that many
 * militia at UNIT_PRICE) so neither kind of cargo dominates the other.
 * Note the freed slaves still have to fit the victor's army slots -- a
 * full army absorbs only what it has room for, and the rest are lost. */
export const CARAVAN_SLAVES_MIN_SHARE = 0.4;
export const CARAVAN_SLAVES_MAX_SHARE = 0.8;

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
    slaves: hasSlaves
      ? Math.max(
          1,
          Math.ceil(
            prizeUnits *
              (CARAVAN_SLAVES_MIN_SHARE +
                Math.random() * (CARAVAN_SLAVES_MAX_SHARE - CARAVAN_SLAVES_MIN_SHARE))
          )
        )
      : 0,
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
