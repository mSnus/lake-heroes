import { MAX_GRID_ARMY_SIZE } from '../constants';
import { proportionalTierSplit } from '../army';

/**
 * Below the cap, 1 real militia/rider = 1 grid unit exactly — HP/damage
 * stats are the weighting now (a rider's bigger HP pool and damage range
 * already expresses "worth more than a militia" on the battlefield), so no
 * proportional rescaling is needed. Only oversized armies (more than the
 * grid can hold) get downscaled, reusing the existing tier-split helper.
 */
export function sizeArmyForGrid(
  militia: number,
  riders: number,
  cap: number = MAX_GRID_ARMY_SIZE
): { militiaCount: number; ridersCount: number; scale: number } {
  const total = militia + riders;
  if (total <= cap) return { militiaCount: militia, ridersCount: riders, scale: 1 };
  const { militiaCount, ridersCount } = proportionalTierSplit(cap, militia, riders);
  return { militiaCount, ridersCount, scale: total / cap };
}

/** Rescale a grid-unit kill count back to how many *real* militia/riders
 * that represents, when the army was downscaled to fit the grid. */
export function realLossFromGridLoss(gridKilled: number, scale: number): number {
  if (gridKilled <= 0) return 0;
  return Math.round(gridKilled * scale);
}
