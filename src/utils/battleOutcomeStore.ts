/**
 * Did the real player win the battle that just resolved? A transient,
 * single-read flag -- not persisted GameState -- set by
 * battleResolution.ts's dispatchBattleResolution the moment a fight's
 * outcome is known, and consumed once by rollAndMove.ts right before it
 * would otherwise re-show the plain tile-info card for wherever the player
 * ended up landing (see its own comment: an "encounter" battle like rogue/
 * caravan/dragon/ambush interrupts movement, so that re-show would
 * otherwise fire for the first time right after the win).
 */
let wonLastBattle = false;

export function markBattleWon(): void {
  wonLastBattle = true;
}

export function consumeBattleWon(): boolean {
  const result = wonLastBattle;
  wonLastBattle = false;
  return result;
}
