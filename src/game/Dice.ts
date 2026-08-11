export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** A hidden (non-visual) roll for automatic non-brawl duels — wider range
 * than the physical 1-6 die shown in brawl mode. */
export function rollDiceWide(): number {
  return Math.floor(Math.random() * 12) + 1;
}

/** Uniform integer roll in [min, max] — used by the grid battle engine for
 * per-unit attack/defence rolls (militia/rider ranges differ, so the fixed
 * rollDice/rollDiceWide ranges don't apply). */
export function rollInRange(min: number, max: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
