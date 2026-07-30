export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** A hidden (non-visual) roll for automatic non-brawl duels — wider range
 * than the physical 1-6 die shown in brawl mode. */
export function rollDiceWide(): number {
  return Math.floor(Math.random() * 12) + 1;
}
